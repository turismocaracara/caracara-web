import { redirect } from 'next/navigation';

export default function TourEditPage({ params }: { params: { slug: string } }) {
  // Editing now happens via modal in /admin/tours
  redirect(`/admin/tours?edit=${params.slug}`);
}
