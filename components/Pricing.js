export default function Pricing() {
  const plans = [
    { id: "free", name: "Free", price: "$0", perks: ["1 channel", "5 thumbnails per video", "Basic analytics (delayed)"] },
    { id: "starter", name: "Starter", price: "$9 / mo", perks: ["3 channels", "50 thumbnails per video", "Faster analytics", "Email support"] },
    { id: "pro", name: "Pro", price: "$29 / mo", perks: ["Unlimited channels", "200 thumbnails per video", "Realtime-ish analytics", "Priority support"] },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {plans.map(p => (
        <div key={p.id} className="p-6 border rounded-lg shadow">
          <h3 className="text-xl font-bold">{p.name}</h3>
          <p className="text-2xl my-4">{p.price}</p>
          <ul className="mb-4 space-y-1">
            {p.perks.map((k,i) => <li key={i}>• {k}</li>)}
          </ul>
          <button className="bg-blue-600 text-white px-4 py-2 rounded">Choose</button>
        </div>
      ))}
    </div>
  );
}
