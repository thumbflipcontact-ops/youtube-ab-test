export default function ThankYouPage() {
return (
<div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white text-center px-6">
<h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-red-400">
🎉 You're In!
</h1>
<p className="text-gray-300 max-w-lg mt-4 text-lg">
Thanks for joining the ThumbFlip private beta. We'll email your access soon.
</p>
<a href="/" className="mt-8 px-6 py-3 bg-white/10 border border-white/20 rounded-full hover:bg-white/20 transition">
Return Home
</a>
</div>
);
}