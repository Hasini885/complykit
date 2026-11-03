import { Card, CardContent } from "@/components/ui/card";

/** Honest stub: says what lands here, rather than faking content. */
export function PhasePlaceholder({ what }: { what: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Not built yet
        </p>
        <p className="mx-auto mt-2 max-w-[52ch] text-sm text-muted-foreground">{what}</p>
      </CardContent>
    </Card>
  );
}
