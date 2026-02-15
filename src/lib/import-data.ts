import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Chargement des variables d'environnement
dotenv.config({ path: '.env.local' });

// --- INTERFACES POUR TYPER LES DONNÉES ---
interface KlickyRecord {
  SetID_Clean: string;
  SetID_Klicky: string;
  'Nom du Set': string;
  Annee_Debut: string;
  Annee_Fin: string;
  Image_URL: string;
  Version: string;
}

interface PmInfoRecord {
  SetID: string;
  'Thème': string;
}

interface PmContentRecord {
  SetID: string;
  PieceRef: string;
  PieceName: string;
  'Quantité': string;
}

type SetCatalogUpsertRow = {
  id: string;
  display_ref: string;
  name: string;
  version: string;
  year_start: number | null;
  year_end: number | null;
  image_url: string;
  theme: string;
};

type SetBomInsertRow = {
  set_id: string;
  piece_ref: string;
  piece_name: string;
  quantity: number;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function importData() {
  console.log("🚀 Démarrage de la GRANDE FUSION...");

  const dataDir = path.join(process.cwd(), 'data');
  
  // Fonction générique pour lire et typer
  function readCsv<T>(filename: string): T[] {
    const filePath = path.join(dataDir, filename);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return parse(fileContent, { 
      columns: true, 
      skip_empty_lines: true,
      trim: true 
    }) as T[];
  }

  console.log("📖 Lecture des CSV...");
  
  // CORRECTION DES NOMS ICI
  const klickyRecords = readCsv<KlickyRecord>('klicky.csv');
  const pmInfoRecords = readCsv<PmInfoRecord>('playmodb_info.csv');
  const pmContentRecords = readCsv<PmContentRecord>('playmodb_content.csv');

  console.log(`📊 Sources chargées :`);
  console.log(`   - Klickypedia : ${klickyRecords.length} lignes`);
  console.log(`   - PlaymoDB Info : ${pmInfoRecords.length} lignes`);
  console.log(`   - PlaymoDB Content : ${pmContentRecords.length} lignes`);

  // --- MAPPING (Dictionnaires) ---
  const themeMap = new Map<string, string>();
  pmInfoRecords.forEach(r => {
    // Nettoyage ID (009 -> 9) pour matcher
    const id = parseInt(r.SetID).toString(); 
    if (r['Thème']) themeMap.set(id, r['Thème']);
  });

  const contentMap = new Map<string, {ref: string, name: string, qty: number}[]>();
  pmContentRecords.forEach(r => {
    const id = parseInt(r.SetID).toString();
    if (!contentMap.has(id)) contentMap.set(id, []);
    contentMap.get(id)?.push({
      ref: r.PieceRef,
      name: r.PieceName,
      qty: parseInt(r['Quantité'] || '1')
    });
  });

  // --- TRAITEMENT & INSERTION ---
  let catalogBatch: SetCatalogUpsertRow[] = [];
  let bomBatch: SetBomInsertRow[] = [];
  const BATCH_SIZE = 100;
  let totalProcessed = 0;

  console.log("⚙️  Traitement et envoi vers Supabase...");

  for (const set of klickyRecords) {
    const cleanRef = set.SetID_Clean;
    const db_id = `${cleanRef}_${set.SetID_Klicky}`; // ID Unique Technique

    const theme = themeMap.get(cleanRef) || "Non classé";
    const yStart = set.Annee_Debut ? parseInt(set.Annee_Debut) : null;
    const yEnd = set.Annee_Fin ? parseInt(set.Annee_Fin) : null;

    // Ajout Catalogue
    catalogBatch.push({
      id: db_id,
      display_ref: cleanRef,
      name: set['Nom du Set'],
      version: set.Version,
      year_start: yStart,
      year_end: yEnd,
      image_url: set.Image_URL,
      theme: theme
    });

    // Ajout Pièces (BOM)
    const pieces = contentMap.get(cleanRef);
    if (pieces) {
      for (const p of pieces) {
        bomBatch.push({
          set_id: db_id,
          piece_ref: p.ref,
          piece_name: p.name,
          quantity: p.qty
        });
      }
    }

    // Batch Insert (tous les 100 sets)
    if (catalogBatch.length >= BATCH_SIZE) {
      // 1. Catalogue
      const { error: errCat } = await supabase.from('sets_catalog').upsert(catalogBatch);
      if (errCat) console.error("❌ Erreur Catalog:", errCat.message);

      // 2. BOM
      if (!errCat && bomBatch.length > 0) {
        const { error: errBom } = await supabase.from('sets_bom').insert(bomBatch);
        if (errBom) {
            // Ignorer silencieusement les doublons éventuels
        }
      }

      totalProcessed += catalogBatch.length;
      console.log(`   ✅ ${totalProcessed} sets traités...`);
      
      // Reset buffers
      catalogBatch = [];
      bomBatch = [];
    }
  }

  // Envoi du dernier paquet
  if (catalogBatch.length > 0) {
    await supabase.from('sets_catalog').upsert(catalogBatch);
    if (bomBatch.length > 0) {
        const BOM_CHUNK = 1000;
        for (let i = 0; i < bomBatch.length; i += BOM_CHUNK) {
            await supabase.from('sets_bom').insert(bomBatch.slice(i, i + BOM_CHUNK));
        }
    }
    totalProcessed += catalogBatch.length;
  }

  console.log(`🎉 TERMINÉ ! ${totalProcessed} sets importés.`);
}

importData().catch(console.error);
