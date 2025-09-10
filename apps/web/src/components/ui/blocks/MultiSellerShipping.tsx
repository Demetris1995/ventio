import React, { useEffect, useState } from 'react';

type Quote = { id: string; name: string; priceWithTax: number; channels: { id: string; code: string }[] };
type SellerBucket = {
  sellerChannelId: string;
  quotes: Quote[];
};

export default function MultiSellerShipping() {
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<SellerBucket[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const fetchBuckets = async () => {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const query = `
        { eligibleShippingMethods {
            id
            code
            name
            priceWithTax
            channels { id code }
          }
        }
      `;
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query }),
      });
      const { data } = await res.json();

      const methods: Quote[] = data?.eligibleShippingMethods ?? [];
      const grouped: Record<string, Quote[]> = {};

      for (const m of methods) {
        const sellerCh = m.channels.find((c: any) => c.code !== 'default-channel');
        if (!sellerCh) continue;
        if (!grouped[sellerCh.id]) grouped[sellerCh.id] = [];
        grouped[sellerCh.id].push(m);
      }

      const sellerBuckets: SellerBucket[] = Object.entries(grouped).map(([sellerChannelId, quotes]) => ({
        sellerChannelId,
        quotes,
      }));

      setBuckets(sellerBuckets);

      // prefill with first quote per seller
      const pre: Record<string, string> = {};
      for (const b of sellerBuckets) {
        if (b.quotes?.[0]) pre[b.sellerChannelId] = b.quotes[0].id;
      }
      setSelection(pre);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load shipping methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuckets();
  }, []);

  const allChosen = buckets.length > 0 && buckets.every(b => selection[b.sellerChannelId]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const methodIds = Object.values(selection);
      const query = `
        mutation($ids:[ID!]!) {
          setOrderShippingMethod(shippingMethodId:$ids) {
            __typename
            ... on Order { id state shippingLines { id shippingMethod { id code name } } }
            ... on ErrorResult { errorCode message }
          }
        }
      `;
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query, variables: { ids: methodIds } }),
      });
      const { data, errors } = await res.json();
      if (errors?.length) throw new Error(errors[0].message);
      if (data?.setOrderShippingMethod?.__typename === 'ErrorResult') {
        throw new Error(data.setOrderShippingMethod.message);
      }
      setOk('Shipping saved. You can continue to payment.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save shipping');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-600">Loading shipping methods…</div>;
  if (!buckets.length) return <div className="text-gray-600">No shipping options found for this cart.</div>;

  return (
    <div className="space-y-6">
      {buckets.map(b => (
        <div key={b.sellerChannelId} className="bg-white rounded-2xl shadow p-4">
          <div className="font-medium mb-3">
            Seller <span className="text-gray-400">({b.sellerChannelId})</span>
          </div>
          <div className="space-y-2">
            {b.quotes.map(q => (
              <label key={q.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name={`ship-${b.sellerChannelId}`}
                  checked={selection[b.sellerChannelId] === q.id}
                  onChange={() => setSelection(prev => ({ ...prev, [b.sellerChannelId]: q.id }))}
                />
                <span className="flex-1">{q.name}</span>
                <span className="tabular-nums">{(q.priceWithTax / 100).toFixed(2)}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          disabled={!allChosen || saving}
          onClick={onSave}
          className={`px-4 py-2 rounded-lg text-white ${
            allChosen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving…' : 'Save shipping choices'}
        </button>
        {error && <span className="text-red-600">{error}</span>}
        {ok && <span className="text-green-600">{ok}</span>}
      </div>
    </div>
  );
}
