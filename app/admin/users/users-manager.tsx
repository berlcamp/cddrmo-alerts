'use client';

import { Trash2, UserPlus } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/form-field';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ActionResult } from '@/lib/action-result';
import { formatShortHeading } from '@/lib/format';
import type { StaffUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { addStaff, removeStaff, setStaffActive } from './actions';

function AddStaffDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const result = await addStaff(prev, formData);
    if (result.ok) {
      setOpen(false);
      toast.success('Staff added. They can now sign in with Google.');
    }
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ size: 'lg' }), 'h-11 cursor-pointer')}>
        <UserPlus aria-hidden /> Add staff
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add staff</DialogTitle>
          <DialogDescription>Enter their Google (Gmail) address. Access starts the first time they sign in.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <FormField label="Gmail address" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="off" required className="h-11" />
          </FormField>
          <FormField label="Full name" htmlFor="full_name">
            <Input id="full_name" name="full_name" required className="h-11" />
          </FormField>
          <FormField label="Position" htmlFor="position" hint="Defaults to Radio Controller on Duty.">
            <Input id="position" name="position" className="h-11" />
          </FormField>
          {state && !state.ok && <p role="alert" className="text-sm font-bold text-danger">{state.message}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="h-11 cursor-pointer">{pending ? 'Adding…' : 'Add staff'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StaffRow({ user }: { user: StaffUser }) {
  const [pending, startTransition] = useTransition();
  const locked = user.role === 'super_admin';
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.message);
    });

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="break-all font-bold">{user.email}</p>
        <p className="text-sm text-muted-foreground">{user.full_name || '—'} · {user.position}</p>
        <p className="text-xs text-muted-foreground">
          {user.last_sign_in_at ? `Last sign-in ${formatShortHeading(user.last_sign_in_at)}` : 'Has not signed in yet'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={locked ? 'default' : 'secondary'}>{locked ? 'Super admin' : 'Encoder'}</Badge>
        {!user.is_active && <Badge variant="destructive">Inactive</Badge>}
        {!locked && (
          <>
            <Button type="button" variant="outline" className="h-11 cursor-pointer" disabled={pending} onClick={() => run(() => setStaffActive(user.id, !user.is_active))}>
              {user.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 cursor-pointer text-danger"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Remove ${user.email} from the staff list?`)) run(() => removeStaff(user.id));
              }}
            >
              <Trash2 aria-hidden /> Remove
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function UsersManager({ users }: { users: StaffUser[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Staff users</h1>
        <AddStaffDialog />
      </div>
      <p className="text-muted-foreground">People on this list can sign in with Google and encode reports. Deactivated users are signed out of editing immediately.</p>
      <ul className="divide-y rounded-xl border bg-card">
        {users.map((user) => <StaffRow key={user.id} user={user} />)}
      </ul>
    </div>
  );
}
