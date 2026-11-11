/** Shown at once while a page that needs the server (e.g. Admin → Users) is on its way. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-foreground/10" />
      <div className="h-64 animate-pulse rounded-3xl bg-foreground/5" />
    </div>
  );
}
