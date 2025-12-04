import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star, ChefHat, Leaf, Pizza } from "lucide-react";

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative bg-muted py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/10 via-background/5 to-background/0 pointer-events-none" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-6">
              <Leaf className="w-3 h-3 mr-1" /> 100% Organic Ingredients
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
              A Slice of <br />
              <span className="text-primary">Naples</span> in Every Bite
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-lg">
              Wood-fired, hand-tossed, and made with San Marzano tomatoes. Experience the authentic taste of Italy right here in your neighborhood.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-lg px-8">
                Order Online <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg">
                View Menu
              </Button>
            </div>
          </div>
        </div>
        {/* Decorative Pizza Circle (CSS only for now) */}
        <div className="absolute -right-20 top-1/2 -translate-y-1/2 hidden lg:block w-[500px] h-[500px] rounded-full bg-primary/10 blur-3xl" />
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChefHat className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Master Chefs</h3>
              <p className="text-muted-foreground">
                Our pizzaiolos are trained in Naples and bring generations of expertise to your table.
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Leaf className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Fresh Ingredients</h3>
              <p className="text-muted-foreground">
                We source locally when possible and import our flour and tomatoes directly from Italy.
              </p>
            </div>
            <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Award Winning</h3>
              <p className="text-muted-foreground">
                Voted "Best Pizza in Town" for 5 years running. Come taste why we're #1.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Product Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 aspect-square bg-muted rounded-2xl flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
               <div className="text-muted-foreground text-center">
                 <Pizza className="w-24 h-24 mx-auto mb-4 opacity-20" />
                 <p>Delicious Pizza Image Placeholder</p>
               </div>
            </div>
            <div className="flex-1">
              <span className="text-primary font-bold tracking-wider uppercase text-sm">Fan Favorite</span>
              <h2 className="text-4xl font-bold mt-2 mb-4">The Margherita Extra</h2>
              <p className="text-muted-foreground text-lg mb-6">
                San Marzano tomato sauce, buffalo mozzarella from Campania, fresh basil, and extra virgin olive oil. Simple, fresh, and absolutely delicious.
              </p>
              <div className="flex items-center gap-4 mb-8">
                <span className="text-3xl font-bold">$18.00</span>
                <div className="flex text-orange-500">
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                  <Star className="w-5 h-5 fill-current" />
                </div>
                <span className="text-muted-foreground">(120+ reviews)</span>
              </div>
              <Button size="lg">Add to Cart</Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
