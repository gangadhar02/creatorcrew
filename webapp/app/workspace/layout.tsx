/**
 * Workspace uses the full viewport height — panes need edge-to-edge layout
 * without the default page container padding.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-8 -my-10 flex min-h-[calc(100vh)] flex-col">
      <div className="flex min-h-0 flex-1 flex-col px-8 py-6">{children}</div>
    </div>
  );
}
