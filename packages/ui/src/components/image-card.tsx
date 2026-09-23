import { cn } from '../lib/cn';

type Props = {
  imageUrl: string;
  caption: string;
  className?: string;
};

export default function ImageCard({ imageUrl, caption, className }: Props) {
  return (
    <figure
      className={cn(
        'w-[250px] overflow-hidden rounded-base border-2 border-border bg-background font-base shadow-shadow',
        className,
      )}
    >
      <img className="aspect-4/3 w-full" src={imageUrl} alt="image" />
      <figcaption className="border-t-2 border-border p-4 text-foreground">{caption}</figcaption>
    </figure>
  );
}
