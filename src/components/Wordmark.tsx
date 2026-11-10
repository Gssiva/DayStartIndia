import { Logo } from "./Logo";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Logo className="h-9 w-9 object-contain" size={40} />
      <span className="wordmark inline-flex items-baseline text-2xl leading-none">
        <span className="text-foreground">Day</span>
        <span className="text-brand-red">Start</span>
      </span>
    </span>
  );
}
