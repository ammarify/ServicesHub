import { Logo } from "./ui/Logo";

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="animate-pulse">
        <Logo size={36} />
      </div>
    </div>
  );
}
