import Hero from "@/components/hero";
import Navbar from "@/components/navbar";
import PricingCard from "@/components/pricing-card";
import Footer from "@/components/footer";
import { createClient } from "../../supabase/server";
import { ArrowUpRight, CheckCircle2, Zap, Shield, Users } from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: plans, error } = await supabase.functions.invoke(
    "supabase-functions-get-plans",
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900">
      <Navbar />
      <Hero />

      {/* Free Trial Section */}
      <section className="py-16 bg-gray-900 border-t border-gray-800">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Try Reelify Free - No Account Required
            </h2>
            <p className="text-gray-300 mb-8">
              Test our platform instantly with any YouTube video. Free version
              includes a small watermark.
            </p>
            <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <input
                  type="url"
                  placeholder="Paste YouTube URL here..."
                  className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                />
                <button className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                  Convert Now
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-4">
                ✨ Instant conversion • 🎬 HD quality • 💧 Small watermark
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white">
              Everything You Need to Create Viral Shorts
            </h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Transform your YouTube content into engaging short-form videos
              with our comprehensive suite of editing tools.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <ArrowUpRight className="w-6 h-6" />,
                title: "YouTube URL Input",
                description:
                  "Simply paste any YouTube URL or upload your video file",
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "Timeline Editor",
                description: "Drag and trim to select the perfect segments",
              },
              {
                icon: <CheckCircle2 className="w-6 h-6" />,
                title: "AI Captions",
                description: "Auto-generated captions with custom styling",
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Music Library",
                description: "Trending tracks and custom audio uploads",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-700"
              >
                <div className="text-purple-400 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2 text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white">How It Works</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Create viral shorts in just 4 simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                title: "Input Video",
                description: "Paste YouTube URL or upload your video file",
              },
              {
                step: "02",
                title: "Select Clips",
                description:
                  "Use our timeline editor to choose the best segments",
              },
              {
                step: "03",
                title: "Customize",
                description: "Add captions, music, and adjust styling",
              },
              {
                step: "04",
                title: "Export",
                description: "Download in perfect format for any platform",
              },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4 mx-auto">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">
                  {item.title}
                </h3>
                <p className="text-gray-300">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-gray-900" id="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white">
              Choose Your Plan
            </h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Start creating viral shorts today. Upgrade anytime as your content
              grows.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans?.map((item: any) => (
              <PricingCard key={item.id} item={item} user={user} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-black">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">
            Ready to Go Viral?
          </h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of content creators who are already turning their
            YouTube videos into viral shorts.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Start Converting Videos
            <ArrowUpRight className="ml-2 w-4 h-4" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
