export default function Marquee({ items }: { items: string[] }) {
  return (
    <div className="relative flex w-full overflow-x-hidden border-t-2 border-b-2 border-border bg-secondary-background font-base text-foreground">
      <div className="animate-marquee py-12 whitespace-nowrap">
        {items.map((item) => {
          return (
            <span key={item} className="mx-4 text-4xl">
              {item}
            </span>
          );
        })}
      </div>

      <div className="absolute top-0 animate-marquee2 py-12 whitespace-nowrap">
        {items.map((item) => {
          return (
            <span key={item} className="mx-4 text-4xl">
              {item}
            </span>
          );
        })}
      </div>

      {/* must have both of these in order to work */}
    </div>
  );
}
