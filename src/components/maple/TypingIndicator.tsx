export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-muted border border-border/60">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium mr-1">Maple</span>
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
