import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Reply, Trash2 } from "lucide-react";
import { addComment, deleteComment, listComments } from "@/lib/social.functions";
import { getSessionState } from "@/lib/library.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Comment = Awaited<ReturnType<typeof listComments>>[number];

export function CommentsSection({ videoId }: { videoId: string }) {
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ["session-state"], queryFn: () => getSessionState() });
  const q = useQuery({ queryKey: ["comments", videoId], queryFn: () => listComments({ data: { videoId } }) });
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["comments", videoId] });
  const addMut = useMutation({
    mutationFn: (v: { body: string; parentId: string | null }) => addComment({ data: { videoId, body: v.body, parentId: v.parentId } }),
    onSuccess: () => { setBody(""); setReplyBody(""); setReplyTo(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteComment({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const items = q.data ?? [];
  const roots = items.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => items.filter((c) => c.parent_id === id);

  const render = (c: Comment, depth = 0) => (
    <div key={c.id} className={depth ? "ml-6 border-l pl-3" : ""}>
      <div className="glass rounded-lg p-3">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{c.author}</span>
          <span>{new Date(c.created_at).toLocaleString()}</span>
        </div>
        <div className={`whitespace-pre-wrap text-sm ${c.deleted ? "italic text-muted-foreground" : ""}`}>{c.body}</div>
        {!c.deleted && (
          <div className="mt-2 flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
              <Reply className="mr-1 h-3 w-3" /> Reply
            </Button>
            {(session.data?.userId === c.user_id || session.data?.isAdmin) && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => delMut.mutate(c.id)}>
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            )}
          </div>
        )}
        {replyTo === c.id && (
          <div className="mt-2 space-y-1">
            <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write a reply…" className="text-sm" rows={2} />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyBody(""); }}>Cancel</Button>
              <Button size="sm" disabled={!replyBody.trim() || addMut.isPending} onClick={() => addMut.mutate({ body: replyBody.trim(), parentId: c.id })}>
                {addMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}Reply
              </Button>
            </div>
          </div>
        )}
      </div>
      {childrenOf(c.id).map((ch) => render(ch, depth + 1))}
    </div>
  );

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Comments ({items.filter((c) => !c.deleted).length})</h2>
      <div className="mb-4 space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" rows={3} />
        <div className="flex justify-end">
          <Button disabled={!body.trim() || addMut.isPending} onClick={() => addMut.mutate({ body: body.trim(), parentId: null })}>
            {addMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Comment
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {roots.length === 0 && !q.isLoading && <div className="text-sm text-muted-foreground">Be the first to comment.</div>}
        {roots.map((c) => render(c))}
      </div>
    </section>
  );
}
