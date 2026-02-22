import { Image as ImageIcon } from "lucide-react";

interface SetImageProps {
  url: string | null;
  name: string;
}

export function SetImage({ url, name }: SetImageProps) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[22px] border border-white/80 bg-gradient-to-br from-white via-white to-sky-50/45 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
      <div className="flex h-full w-full items-center justify-center p-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={name}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <ImageIcon className="h-10 w-10" />
            <span className="text-xs italic text-slate-400">Pas d&apos;image</span>
          </div>
        )}
      </div>
    </div>
  );
}
