import { OrdinaryProjectNotice } from "@/app/app/projects/ordinary/ordinary-project-notice";

export default function OrdinaryProjectPage() {
  return (
    <main
      className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-8 sm:py-10 lg:px-12"
      id="main-content"
      tabIndex={-1}
    >
      <OrdinaryProjectNotice />
    </main>
  );
}
