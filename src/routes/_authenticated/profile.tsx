import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Workwise" },
      { name: "description", content: "Manage your Workwise profile." },
      { property: "og:title", content: "Profile — Workwise" },
      { property: "og:description", content: "Manage your Workwise profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const profile = useQuery({ queryKey: ["profile"], queryFn: async () => (await supabase.from("profiles").select("*").maybeSingle()).data });
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (profile.data) { setName(profile.data.full_name ?? ""); setTitle(profile.data.job_title ?? ""); }
  }, [profile.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: name, job_title: title, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Profile" subtitle={user?.email} />
      <form onSubmit={save} className="space-y-4 rounded-2xl border bg-card p-6 shadow-soft">
        <div className="space-y-1.5"><Label htmlFor="n">Full name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="t">Job title</Label><Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <Button>Save changes</Button>
      </form>
      <Button variant="outline" className="mt-6" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}><LogOut /> Log out</Button>
    </div>
  );
}
