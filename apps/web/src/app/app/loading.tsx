import { LoadingState } from '@/components/ui/skeleton';
export default function Loading() {
  // No previous account or context is shown before the new bootstrap completes.
  return <main id="main" className="mx-auto max-w-6xl px-6 py-12"><LoadingState /></main>;
}
