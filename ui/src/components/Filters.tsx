import { Input } from "./ui/Input";
import { Button } from "./ui/Button";

export default function Filters({
  value,
  onChange,
  onApply,
}: {
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
      <Input
        className="flex-1 sm:max-w-sm"
        placeholder="Search…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onApply()}
      />
      <Button variant="outline" onClick={onApply}>
        Search
      </Button>
    </div>
  );
}
