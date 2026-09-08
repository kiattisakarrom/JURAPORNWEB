import { WorkspaceApp } from "@/features/shell/WorkspaceApp";

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <WorkspaceApp />
      {children}
    </>
  );
}
