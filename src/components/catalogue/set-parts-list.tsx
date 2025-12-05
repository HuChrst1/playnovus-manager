"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EditPieceDialog } from "@/components/catalogue/edit-piece-dialog";
import { DeletePieceButton } from "@/components/catalogue/delete-piece-button";

interface PartWithStock {
  id: number;
  set_id: string;
  piece_ref: string;
  piece_name: string | null;
  quantity: number;
  inStock: number;
}

export function SetPartsList({ parts }: { parts: PartWithStock[] }) {
  if (!parts || parts.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-400 italic bg-zinc-50/50 m-4 rounded-lg border border-dashed border-zinc-200">
        Aucune pièce associée à ce set.
      </div>
    );
  }

  return (
    <div className="w-full text-sm font-sans">
      {/* En-têtes */}
      <div className="grid grid-cols-12 px-4 py-3 text-xs font-bold text-zinc-500 uppercase bg-white border-b border-zinc-200 sticky top-0 z-20 shadow-sm">
        <div className="col-span-2 text-center">Qté</div>
        <div className="col-span-2 pl-2">Réf.</div>
        <div className="col-span-7">Description</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>

      {/* Liste */}
      <div className="divide-y divide-zinc-100 bg-white">
        {parts.map((part) => {
          const ratio = part.quantity > 0 ? part.inStock / part.quantity : 0;
          const percentage = Math.min(100, ratio * 100);
          
          let barColor = "bg-red-50"; 
          if (ratio >= 1) barColor = "bg-emerald-100/60";
          else if (ratio >= 0.5) barColor = "bg-emerald-50/50";
          else if (ratio > 0) barColor = "bg-orange-50/60";

          return (
            <div
              key={part.id}
              className="relative grid grid-cols-12 items-center h-12 group overflow-hidden hover:bg-zinc-50 transition-colors"
            >
              {/* JAUGE FOND */}
              <div
                className={`absolute top-0 left-0 h-full transition-all duration-700 ease-out z-0 ${barColor}`}
                style={{ width: `${percentage}%` }}
              />

              {/* 1. Qté (2 cols) */}
              <div className="col-span-2 relative z-10 text-center">
                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${ratio === 1 ? 'text-emerald-700 bg-emerald-100/50 border border-emerald-200' : 'text-zinc-700 bg-white/60 border border-zinc-200'}`}>
                  {part.inStock} / {part.quantity}
                </span>
              </div>

              {/* 2. Réf (2 cols) */}
              <div className="col-span-2 relative z-10 pl-2 font-mono text-xs font-medium text-zinc-600 select-all">
                {part.piece_ref}
              </div>

              {/* 3. Description (7 cols - Agrandie) */}
              <div className="col-span-7 relative z-10 pr-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-left w-full focus:outline-none cursor-pointer group-hover:text-blue-700 transition-colors truncate block">
                      <span className="font-medium text-zinc-700 group-hover:text-blue-700">
                        {part.piece_name || "Nom inconnu"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4 text-sm bg-white shadow-xl border-zinc-200 z-50">
                    <div className="font-bold mb-1 text-zinc-900 flex justify-between">
                      <span>Détail Pièce</span>
                      <span className="font-mono text-xs text-zinc-400">{part.piece_ref}</span>
                    </div>
                    <p className="text-zinc-600 leading-relaxed border-t border-zinc-100 pt-2 mt-1">
                      {part.piece_name || "Pas de description."}
                    </p>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 4. Actions (1 col - Réduite et collée à droite) */}
              <div className="col-span-1 relative z-10 flex justify-end items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex bg-white/80 rounded-md shadow-sm border border-zinc-100 backdrop-blur-sm">
                    <EditPieceDialog setId={part.set_id} piece={part} />
                    <DeletePieceButton id={part.id} setId={part.set_id} refName={part.piece_ref} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}