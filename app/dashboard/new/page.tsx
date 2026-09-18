import { RequestForm } from "@/components/content/RequestForm";

export default function NewContentRequestPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">New content request</h1>
        <p className="mt-1 text-sm text-slate-500">
          Submit a topic and let research, drafting, and self-evaluation run before it lands in your review queue.
        </p>
      </div>
      <RequestForm />
    </div>
  );
}
