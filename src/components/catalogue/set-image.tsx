import { Image as ImageIcon } from "lucide-react";

interface SetImageProps {
  url: string | null;
  name: string;
}

export function SetImage({ url, name }: SetImageProps) {
  return (
    <div className="relative w-full aspect-[4/3] rounded-xl border border-zinc-300 bg-white shadow-sm overflow-hidden">
      <div className="w-full h-full flex items-center justify-center p-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center text-zinc-300 gap-2">
            <ImageIcon className="h-10 w-10" />
            <span className="italic">Pas d'image</span>
          </div>
        )}
      </div>
    </div>
  );
}