import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Link from "next/link";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export default async function CataloguePage() {
  const { data: sets, error } = await supabase
    .from("sets_catalog")
    .select("*")
    .limit(50)
    .order("display_ref", { ascending: true });

  if (error) return <div className="p-8 text-red-500">Erreur : {error.message}</div>;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Catalogue PlayNovus</h1>
        <Button>Ajouter un Set</Button>
      </div>

      <Dialog>
  <DialogTrigger asChild>
    <Button>TEST DIALOG</Button>
  </DialogTrigger>
  <DialogContent>
    <div className="p-10">ÇA MARCHE !</div>
  </DialogContent>
</Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {sets?.map((set) => (
          <Link href={`/catalogue/${set.id}`} key={set.id}>
            <Card className="overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow cursor-pointer">
              <div className="bg-slate-100 dark:bg-slate-900 border-b">
                <AspectRatio ratio={4 / 3}>
                  {set.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={set.image_url}
                      alt={set.name}
                      className="object-contain w-full h-full p-2 mix-blend-multiply"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">Pas d'image</div>
                  )}
                </AspectRatio>
              </div>
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="text-lg font-bold">{set.display_ref}</Badge>
                  {set.version && set.version !== "Version Unique" && (
                    <Badge variant="secondary" className="text-xs">{set.version}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex-grow">
                <h3 className="font-semibold leading-tight mb-2 line-clamp-2">{set.name}</h3>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}