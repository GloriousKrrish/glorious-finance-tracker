import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Pencil, Plus } from "lucide-react";

export function AddButton({ label, children, open, onOpenChange }: { label: string; children: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [internal, setInternal] = useState(false);
  const isControlled = open !== undefined;
  const o = isControlled ? open : internal;
  const set = isControlled ? onOpenChange! : setInternal;
  return (
    <Dialog open={o} onOpenChange={set}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-1 h-4 w-4" />{label}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">{children}</DialogContent>
    </Dialog>
  );
}

export function EditIconButton({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">{children(() => setOpen(false))}</DialogContent>
    </Dialog>
  );
}

export function DeleteIconButton({ onConfirm, itemLabel }: { onConfirm: () => void; itemLabel: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemLabel}?</AlertDialogTitle>
          <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FormDialogHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <DialogHeader>
      <DialogTitle className="font-display">{title}</DialogTitle>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </DialogHeader>
  );
}

export function FormFooter({ onCancel, submitLabel = "Save" }: { onCancel: () => void; submitLabel?: string }) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">{submitLabel}</Button>
    </DialogFooter>
  );
}
