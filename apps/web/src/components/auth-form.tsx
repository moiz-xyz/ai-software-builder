'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useMe } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/misc';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const { reload } = useMe();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setBusy(true);
    setError('');
    try {
      const res = await api<{ user: { role: string } }>(`/auth/${mode}`, { method: 'POST', json: data });
      reload();
      const next = params.get('next');
      router.push(next && next.startsWith('/') ? next : res.user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto mt-10 max-w-md">
      <CardHeader>
        <CardTitle>{mode === 'login' ? 'Sign in' : 'Create your account'}</CardTitle>
        <CardDescription>{mode === 'login' ? 'Welcome back.' : 'Start building from a template in minutes.'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <Field label="Your name" required><Input name="name" required minLength={2} /></Field>
              <Field label="Company"><Input name="company" /></Field>
            </>
          )}
          <Field label="Email" required><Input name="email" type="email" required autoComplete="email" /></Field>
          <Field label="Password" required help={mode === 'register' ? 'At least 8 characters.' : undefined}>
            <Input name="password" type="password" required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <Button className="w-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</Button>
          <p className="text-center text-sm text-muted-foreground">
            {mode === 'login' ? <>No account? <Link className="underline" href="/register">Create one</Link></> : <>Already registered? <Link className="underline" href="/login">Sign in</Link></>}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
