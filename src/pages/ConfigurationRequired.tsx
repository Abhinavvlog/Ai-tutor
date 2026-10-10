interface ConfigurationRequiredProps {
  message: string
}

export function ConfigurationRequired({ message }: ConfigurationRequiredProps) {
  return (
    <main className="min-h-screen bg-[var(--color-background)] p-6 flex items-center justify-center">
      <section className="w-full max-w-xl rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-3 text-2xl font-bold text-[var(--color-navy)]">
          MyGuru needs Supabase setup
        </h1>
        <p className="mb-5 text-[var(--color-text)]">{message}</p>
        <p className="mb-3 text-sm text-gray-700">
          In the project’s <code>.env</code> file, replace the example values with your
          project URL and anon/publishable key from Supabase Project Settings → API:
        </p>
        <pre className="mb-5 overflow-x-auto rounded bg-gray-100 p-4 text-sm">
          <code>{`VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key`}</code>
        </pre>
        <p className="text-sm text-gray-700">
          Save the file and restart the dev server. Do not use your Supabase service-role key
          in this client-side app.
        </p>
      </section>
    </main>
  )
}
