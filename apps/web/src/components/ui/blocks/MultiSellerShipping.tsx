import { useEffect, useState } from 'react';

type Quote = { id: string; code: string; name: string; priceWithTax: number };
type Bucket = { sellerChannelId: string; sellerName?: string | null; quotes: Quote[] };

export default function MultiSellerShipping() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/checkout/eligible-by-seller.json');
      if (!res.ok) throw new Error('Failed to load shipping options');
      const data: Bucket[] = await res.json();
      setBuckets(data);
      const init: Record<string, string> = {};
      data.forEach(b => { if (b.quotes[0]) init[b.sellerChannelId] = b.quotes[0].id; });
      setSelected(init);
    })().catch(e => setError(e.message));
  }, []);

  const submit = async () => {
    setBusy(true); setError(null); setOk(false);
    try {
      const selections = Object.entries(selected).map(([sellerChannelId, shippingMethodId]) => ({
        sellerChannelId, shippingMethodId,
      }));
      const res = await fetch('/api/checkout/set-shipping-per-seller', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selections }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save');
      setOk(true);
    } catch (e: any) {
      setError(e.message ?? 'Failed to set shipping');
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="rounded-xl border border-red-300 p-3 text-red-700 text-sm">{error}</div>;
  if (!buckets.length) return <div className="text-sm text-gray-500">No seller shipping options yet.</div>;

  return (
    <div className="space-y-6">
      {buckets.map(b => (
        <div key={b.sellerChannelId} className="rounded-2xl shadow p-4 border">
          <div className="mb-2 text-sm font-semibold">
            Shipping for seller: <span className="text-gray-700">{b.sellerName ?? b.sellerChannelId}</span>
          </div>
          <div className="space-y-2">
            {b.quotes.map(q => (
              <label key={q.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name={`seller-${b.sellerChannelId}`}
                  className="h-4 w-4"
                  checked={selected[b.sellerChannelId] === q.id}
                  onChange={() => setSelected(s => ({ ...s, [b.sellerChannelId]: q.id }))}
                />
                <span className="text-sm">{q.name} — {(q.priceWithTax / 100).toFixed(2)}€</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-60">
        {busy ? 'Saving…' : 'Save shipping choices'}
      </button>

      {ok && <div className="text-green-700 text-sm">Saved!</div>}
    </div>
  );
}
