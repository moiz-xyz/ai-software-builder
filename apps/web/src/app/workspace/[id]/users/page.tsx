'use client';
import { useParams } from 'next/navigation';
import { Team } from '@/components/team';

export default function UsersPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users & roles</h1>
      <div className="rounded-lg bg-white p-4"><Team projectId={id} /></div>
    </div>
  );
}
