import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { PlatformShell } from '@/components/shell';

export default function LoginPage() {
  return <PlatformShell><Suspense><AuthForm mode="login" /></Suspense></PlatformShell>;
}
