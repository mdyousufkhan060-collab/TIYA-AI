import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { SettingsBar } from '../settings/SettingsShell';

/**
 * Admin > 22 WEBSITE BUILDER (DEMO): the full plan of ROSE Store Builder as
 * tappable bars, so the admin can see every bar and what is inside it before
 * it is built. Nothing here changes data.
 */
type Node = { title: string; value?: string; lines?: string[]; children?: Node[] };

const n = (title: string, lines: string[], value?: string): Node => ({ title, lines, value });

const TREE: Node[] = [
  {
    title: 'HOSTING OPTIONS',
    value: '3 WAYS',
    children: [
      n('ROSE SUBDOMAIN', [
        'Store link: yourshop.myrosebd.com',
        'Ready in about 1 minute after PUBLISH',
        'Free SSL (https), no hosting to buy',
        'Runs on the fast ROSE Store Engine (Vercel + Supabase)',
      ], 'DEFAULT'),
      n('OWN DOMAIN', [
        'Connect yourshop.com bought from any seller (Hostinger, Namecheap, GoDaddy)',
        'Panel shows the 2 DNS records to add, ROSE checks them automatically',
        'Free SSL is issued when the domain is connected',
        'Old subdomain link redirects to the new domain (keeps Google ranking)',
      ]),
      n('HOSTINGER (SELF HOST)', [
        'DOWNLOAD FOR HOSTINGER: one ZIP of the store',
        'Upload to Hostinger (Node.js or static hosting) with your own domain',
        'Products, orders and admin still managed from the ROSE panel',
        'Optional full copy with its own database for big businesses',
        'Step-by-step guide shown inside the panel',
      ]),
    ],
  },
  {
    title: 'PLANS',
    value: 'PREMIUM ONLY',
    children: [
      n('FREE USERS', ['Can open and scroll every demo store', 'BUILD button shows: Upgrade to Premium']),
      n('5-DAY FREE TRIAL', ['One free trial per Gmail, no payment needed', 'Full WEBSITE PRO features for 5 days on yourshop.myrosebd.com', 'Day 4: ROSE reminds to choose a plan', 'After 5 days the store is paused (not deleted) until a plan is bought']),
      n('DURATIONS', ['3 months: normal price', '6 months: 5% off', '9 months: 10% off', '12 months: 15% off', '24 months (2 years): 25% off', 'All numbers editable in 05 PLANS & PRICES']),
      n('WEBSITE STARTER', ['999 Tk / month', '1 store on myrosebd.com/shop/name', '300 products, 5 GB photos, 1 staff', '500 AI chat replies / month', 'Cash on Delivery, bKash / Nagad / Rocket', '3 months 2,997 Tk · 12 months 10,190 Tk · 24 months 17,982 Tk'], 'PLAN'),
      n('WEBSITE PRO', ['1,999 Tk / month', '1 store, own domain allowed', 'Unlimited products, 10 GB photos, 3 staff', '3,000 AI chat replies / month, Pixels & Analytics, coupons, courier booking', '3 months 5,997 Tk · 12 months 20,390 Tk · 24 months 35,982 Tk'], 'PLAN'),
      n('WEBSITE BUSINESS', ['3,999 Tk / month', '3 stores, own domains, 25 GB photos, 10 staff', '10,000 AI chat replies / month, Hostinger download, card gateway help', 'Priority support', '3 months 11,997 Tk · 12 months 40,790 Tk · 24 months 71,982 Tk'], 'PLAN'),
      n('DOMAIN (EXTRA)', ['.com: sell 1,800 Tk / year (our cost about 1,250-1,750)', '.com.bd: sell 1,500 Tk / year (BTCL 700 new, 1,020 renewal)', '.bd: sell 2,200 Tk / year (BTCL 1,280 new, 1,600 renewal)', 'Customer can also bring a domain they already own']),
      n('MARKET COMPARE', ['ZatiqEasy: Starter 599, Pro 1,099, Growth 2,499 Tk / month + a fee on every order', 'DeshiCommerce: Starter about 500 Tk / month', 'BitCommerz: 1,299 and 2,999 Tk / month', 'Agencies: 20,000-75,000 Tk one time + yearly renewal', 'ROSE: no fee per order, AI chat and ROSE voice help included']),
      n('COSTS & PROFIT', ['Photos are stored in Supabase Storage (very cheap per GB), not on the Hostinger plan', 'Hostinger Business plan has limited disk for all sites, so it is used only for stores that choose self-host', 'Per store cost / month (estimate): storage + traffic 30-80 Tk, AI chat 100-600 Tk, SMS extra', 'Fixed costs: office, staff salaries, Vercel, Supabase, support phone', 'Break-even = fixed costs / (plan price - per store cost)', 'Example: 60,000 Tk fixed, PRO margin about 1,500 Tk = 40 PRO stores to cover costs']),
      n('ROSE CREDITS ARE SEPARATE', ['Website plans do not use ROSE text / voice credits', 'Buying ROSE Premium does not give a website, and a website plan does not give ROSE credits', 'Admin gives website access in 23 WEBSITE ACCESS']),
      n('HOW-TO VIDEOS', ['Short videos on the website with finger marks on each tap', 'How to start the 5-day free trial', 'What each plan gives', 'How to connect your own domain', 'How to add Facebook Pixel, TikTok Pixel and Google Analytics', 'Admin writes the script, voice is recorded, then the video is made']),
    ],
  },
  {
    title: 'DEMO STORES',
    value: '6',
    children: [
      n('FOODBAZAAR', ['Restaurant and food delivery', 'Category row: Burger, Pizza, Fried Chicken, Drinks, Desserts', 'Popular Foods with discount badges, Order Now banners', 'Delivery area and time slot at checkout']),
      n('FASHIONHUB', ['Clothing store', 'Size and colour choice, size chart', 'Hot Deals, Wishlist heart on every card', 'Category: T-Shirts, Polo, Shirts, Hoodies']),
      n('SOTADARI', ['Grocery and daily needs', 'Weight units (1kg, 5kg), Flash Deal with timer', 'Fast Delivery, Secure Payment, 24/7 Support row', 'Minimum order and free delivery limit']),
      n('SHOPSHOTOI', ['All-in-one marketplace style', 'Fashion, Gadgets, Home, Electronics, Beauty', 'Flash Sale, Free Delivery On 499+', 'Many banners and sections']),
      n('HOMENEST (FURNITURE)', ['Living room, Bedroom, Office, Kitchen', 'Size, wood type and colour options, many photos', 'EMI / installment info, fitting charge', 'Showroom address with map']),
      n('MEDICARE (PHARMACY)', ['Search by medicine or generic name', 'PRESCRIPTION UPLOAD required for non-OTC medicine', 'Pharmacist approves before the order is confirmed', 'Drug licence number shown in the footer', 'Chat never gives dose advice, sends to a pharmacist or doctor']),
    ],
  },
  {
    title: 'STORE ADMIN PANEL',
    value: '20 BARS',
    children: [
      n('DASHBOARD', ['Today: orders, sales, visitors', 'Low stock, pending orders, new chats', 'Sales chart: day, week, month']),
      n('ORDERS', ['New, Confirmed, Packed, Shipped, Delivered, Returned', 'Print invoice and sticker', 'Book courier: Steadfast, Pathao, RedX', 'Call / OTP to confirm, fraud check by phone history']),
      n('PRODUCTS', ['ADD PRODUCT: name, price, sale price, stock, SKU', 'IMAGES: many photos, auto WebP', 'VARIANTS: size, colour, weight', 'BULK UPLOAD: Excel', 'SEO box for each product', 'Add by voice: tell ROSE name and price']),
      n('CATEGORIES', ['Category and sub-category', 'Icon or image for the category row', 'Order and show / hide']),
      n('HOMEPAGE', ['Banner slider', 'Sections order: categories, flash sale, popular, offers', 'Flash Sale timer', 'Colours, logo, font']),
      n('OFFERS & COUPONS', ['Coupon code: % or fixed', 'Free delivery offer', 'Buy X get Y']),
      n('CUSTOMERS', ['List with orders and total spent', 'Block fake buyers', 'Loyalty points']),
      n('REVIEWS', ['Only real buyers can review (Verified Buyer)', 'Stars, text and photos', 'Reply or hide bad words']),
      n('LIVE CHAT', ['All website chats in one place', 'ROSE answers first, TAKE OVER to answer yourself', 'See what the customer is typing']),
      n('PAYMENTS', ['Cash on Delivery', 'bKash, Nagad, Rocket (manual TrxID, later merchant API)', 'Cards via SSLCommerz / aamarPay / ShurjoPay (trade licence needed)', 'Bank transfer']),
      n('DELIVERY', ['Inside / outside Dhaka charge', 'Courier accounts', 'Delivery time text']),
      n('TRACKING & PIXELS', ['Facebook Pixel + Conversions API', 'TikTok Pixel', 'Google Analytics 4, Google Tag Manager', 'Search Console verification', 'Events sent automatically: View, Add to Cart, Purchase']),
      n('SEO', ['Title and description for every page', 'SEO SCORE: what is missing on each product', 'Sitemap and robots.txt automatic']),
      n('BLOG', ['Posts to bring Google visitors', 'ROSE can write a post from a title']),
      n('PAGES & FOOTER', ['About, Contact, Privacy, Return, Terms', 'Address, phone, email, social links', 'Payment logos, Play Store button']),
      n('ABANDONED CARTS', ['People who left items in the cart', 'Send a reminder']),
      n('RETURNS', ['Return / exchange requests', 'Approve or reject with a note']),
      n('NOTIFICATIONS', ['New order by SMS, e-mail or WhatsApp', 'ROSE tells the owner by voice']),
      {
        title: 'STAFF',
        value: 'GMAIL',
        children: [
          n('ADD STAFF', ['Type the staff Gmail, choose a ROLE, tap SEND INVITE', 'Staff gets an e-mail and a notice in ROSE', 'Staff signs in with that same Gmail (Google login)', 'Sees ONLY the bars their role allows', 'Limit by plan: Starter 1, Pro 3, Business 10 staff']),
          n('ROLES', ['MANAGER: everything except payments setup, domain and staff', 'ORDER STAFF: Orders, courier booking, invoices, returns', 'PRODUCT STAFF: Products, categories, images, stock', 'CHAT SUPPORT: Live chat and reviews replies', 'MARKETING: Offers, coupons, homepage banners, pixels, blog', 'ACCOUNTS: Dashboard, sales reports, payments list (view only)', 'CUSTOM: owner ticks each bar ON / OFF (view or edit)']),
          n('SAFETY', ['Only the OWNER can delete the store, change payment numbers, domain or staff', 'Every action is checked on the server, a hidden button is not enough', 'Staff cannot see customer card or bank details', 'REMOVE: access stops at once, also logs out', 'Pause staff for a few days without deleting']),
          n('ACTIVITY LOG', ['Who did what and when: price change, order status, refunds', 'Filter by staff name', 'ROSE can read it out: \u201cRahim changed 3 prices today\u201d']),
        ],
      },
      n('DOMAIN & HOSTING', ['Subdomain, own domain or Hostinger download', 'Backup: export products and orders to Excel']),
    ],
  },
  {
    title: 'CUSTOMER SIDE',
    value: 'PAGES',
    children: [
      n('PAGES', ['Home, Categories, Product list with filters, Product details', 'Search, Cart, Checkout, Order success, Order tracking', 'Wishlist, Account, About, Contact, Policies, FAQ']),
      n('ACCOUNT', ['Login with Google or phone OTP, or order as guest', 'My Orders with courier tracking and RE-ORDER', 'Return / exchange request', 'Loyalty points']),
      n('SHOPPING HELP', ['Notify me when back in stock', 'Recently viewed, similar items, bought together', 'Coupon box', 'Add to home screen (works like an app)']),
    ],
  },
  {
    title: 'LIVE CHAT & ROSE',
    value: 'AI',
    children: [
      n('ON THE WEBSITE', ['Chat button on every page', 'ROSE answers price, stock, delivery and order status from the store data', 'Loads after the page so speed stays high']),
      n('FOR THE OWNER', ['Every chat arrives in the owner’s ROSE app', 'ROSE says by voice what the customer wants', 'TAKE OVER to reply yourself', 'Order confirmation on WhatsApp']),
    ],
  },
  {
    title: 'SEO & GOOGLE RANKING',
    value: 'AUTO',
    children: [
      n('SPEED', ['Main image in under 2.5 seconds on mobile', 'WebP images, lazy loading', 'Trackers and chat load after the page']),
      n('STRUCTURED DATA', ['Product, Offer, Review, Breadcrumb, FAQ', 'Organization and LocalBusiness', 'Google Merchant Center product feed']),
      n('PAGES', ['Clean links: /product/black-cotton-tshirt', 'Title, description and image alt written by ROSE', 'Sitemap, robots.txt, internal links']),
      n('HONEST NOTE', ['Nobody can promise first place on Google', 'Good product text, real reviews and new posts are still needed']),
    ],
  },
  {
    title: 'ROSE ADMIN CONTROLS',
    value: 'YOU',
    children: [
      n('WEBSITE ACCESS', ['Give or remove builder access by Gmail', 'Any mode: Personal, Student, Business', 'Limit: number of stores and end date', 'Premium plan turns access on automatically']),
      n('ALL STORES', ['Every store made with ROSE', 'Open, suspend or restore any store', 'Owner, plan, domain, orders']),
      n('DEMOS', ['Choose which demos show on myrosebd.com/demos', 'Send a demo link to a customer']),
      n('SAFETY', ['No fake bank / office pages, no scams, no gambling', 'Pharmacy stores must show a drug licence']),
    ],
  },
  {
    title: 'BUILD STEPS',
    value: 'PLAN',
    children: [
      n('STEP 1', ['Store Engine and 6 demos on myrosebd.com/demos'], 'NEXT'),
      n('STEP 2', ['Store admin: Products, Categories, Orders, Homepage']),
      n('STEP 3', ['Payments, Delivery, Pixels and Analytics, Live chat']),
      n('STEP 4', ['ROSE builds a store by voice, Gmail access, Premium plans']),
      n('STEP 5', ['Own domain, Hostinger download, merchant payments, Play Store app']),
    ],
  },
];

export const AdminWebsiteBuilderDemo: React.FC = () => {
  const [path, setPath] = useState<number[]>([]);

  let nodes = TREE;
  let current: Node | null = null;
  for (const i of path) {
    current = nodes[i];
    nodes = current.children || [];
  }
  const pad = (i: number) => String(i + 1).padStart(2, '0');

  return (
    <div className="space-y-2">
      {path.length === 0 ? (
        <p className="px-1 pb-1 text-[11px] text-slate-400">
          DEMO PLAN. Tap a bar to see what is inside. Nothing here is live yet.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setPath((p) => p.slice(0, -1))}
          className="flex min-h-[40px] items-center gap-1 rounded-lg px-1 text-[11px] font-bold tracking-wider text-teal-400"
        >
          <ChevronLeft className="h-4 w-4" />
          {current?.title}
        </button>
      )}

      {current?.lines && (
        <div className="space-y-1.5 rounded-xl border border-white/[0.08] bg-[#11151E] p-3">
          {current.lines.map((l) => (
            <p key={l} className="flex gap-2 text-[12px] leading-snug text-slate-200">
              <span className="text-teal-400">•</span>
              <span>{l}</span>
            </p>
          ))}
        </div>
      )}

      {nodes.length > 0 && (
        <div className="space-y-1.5">
          {nodes.map((node, i) => (
            <SettingsBar
              key={node.title}
              badge={pad(i)}
              title={node.title}
              value={node.value}
              onClick={() => setPath((p) => [...p, i])}
              testId={`wb-bar-${i}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
