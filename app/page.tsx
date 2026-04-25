import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="border-b border-line pb-8">
        <p className="text-sm font-medium text-accent">Twitter/X brand voice replication</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-ink">
          Upload your past writing. Get a reusable Voice Skill File. Generate tweets that sound like you.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          This local MVP turns archive samples into a structured voice file, then uses it to draft and refine Twitter-native posts.
        </p>
        <Link href="/brands/new" className="mt-6 inline-flex rounded-ui bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-black">
          Create Brand Voice Workspace
        </Link>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-ink">Brand workspaces</h2>
        <p className="mt-2 text-sm text-muted">Workspaces will appear here after the database is wired.</p>
      </section>
    </div>
  );
}
