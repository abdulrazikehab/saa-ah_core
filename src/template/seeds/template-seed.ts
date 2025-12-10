// Pre-defined website templates
export const templateSeeds = [
  // 1. Fashion Store Template
  {
    name: 'Fashion Store',
    category: 'fashion',
    description: 'Modern, image-heavy design perfect for fashion retailers',
    thumbnail: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=600&fit=crop',
    isDefault: true,
    content: {
      sections: [
        {
          id: 'hero-fashion',
          type: 'hero',
          props: {
            title: 'Summer Collection 2024',
            subtitle: 'Discover the latest fashion trends',
            backgroundImage: '',
            ctaText: 'Shop Now',
            ctaLink: '/products',
            textColor: '#ffffff',
            backgroundColor: '#000000',
          },
        },
        {
          id: 'features-fashion',
          type: 'features',
          props: {
            title: 'Why Shop With Us',
            items: [
              { icon: '🚚', title: 'Free Shipping', description: 'On orders over $50' },
              { icon: '↩️', title: 'Easy Returns', description: '30-day return policy' },
              { icon: '👗', title: 'Latest Trends', description: 'Always in style' },
            ],
          },
        },
        {
          id: 'products-fashion',
          type: 'products',
          props: {
            title: 'Featured Collection',
            limit: 8,
            layout: 'grid',
          },
        },
        {
          id: 'cta-fashion',
          type: 'cta',
          props: {
            title: 'Join Our Fashion Community',
            description: 'Get exclusive access to new arrivals and special offers',
            buttonText: 'Sign Up Now',
            buttonLink: '/auth/signup',
            backgroundColor: '#1a1a1a',
            textColor: '#ffffff',
          },
        },
        {
          id: 'footer-fashion',
          type: 'footer',
          props: {
            companyName: 'Fashion Store',
            links: [
              { label: 'About Us', url: '/about' },
              { label: 'Contact', url: '/contact' },
              { label: 'Shipping Info', url: '/shipping' },
            ],
            socialLinks: {
              instagram: '',
              facebook: '',
              pinterest: '',
            },
          },
        },
      ],
    },
  },
  
  // 2. Electronics Shop Template
  {
    name: 'Electronics Shop',
    category: 'electronics',
    description: 'Tech-focused design with product grid layout',
    thumbnail: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&h=600&fit=crop',
    isDefault: true,
    content: {
      sections: [
        {
          id: 'hero-electronics',
          type: 'hero',
          props: {
            title: 'Cutting-Edge Technology',
            subtitle: 'Latest gadgets and electronics',
            backgroundImage: '',
            ctaText: 'Browse Products',
            ctaLink: '/products',
            textColor: '#ffffff',
            backgroundColor: '#1e3a8a',
          },
        },
        {
          id: 'features-electronics',
          type: 'features',
          props: {
            title: 'Our Guarantees',
            items: [
              { icon: '✅', title: 'Authentic Products', description: '100% genuine' },
              { icon: '🔧', title: 'Warranty Support', description: 'Full coverage' },
              { icon: '⚡', title: 'Fast Delivery', description: '2-day shipping' },
            ],
          },
        },
        {
          id: 'products-electronics',
          type: 'products',
          props: {
            title: 'Top Selling Products',
            limit: 12,
            layout: 'grid',
          },
        },
        {
          id: 'footer-electronics',
          type: 'footer',
          props: {
            companyName: 'Tech Store',
            links: [
              { label: 'Support', url: '/support' },
              { label: 'Warranty', url: '/warranty' },
              { label: 'Compare', url: '/compare' },
            ],
            socialLinks: {
              twitter: '',
              youtube: '',
              linkedin: '',
            },
          },
        },
      ],
    },
  },
  
  // 3. Food & Beverage Template
  {
    name: 'Food & Beverage',
    category: 'food',
    description: 'Warm, appetizing design for restaurants and food businesses',
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
    isDefault: true,
    content: {
      sections: [
        {
          id: 'hero-food',
          type: 'hero',
          props: {
            title: 'Fresh, Delicious, Delivered',
            subtitle: 'Order your favorite meals online',
            backgroundImage: '',
            ctaText: 'View Menu',
            ctaLink: '/products',
            textColor: '#ffffff',
            backgroundColor: '#dc2626',
          },
        },
        {
          id: 'features-food',
          type: 'features',
          props: {
            title: 'Why Choose Us',
            items: [
              { icon: '🍽️', title: 'Fresh Ingredients', description: 'Daily sourced' },
              { icon: '⏱️', title: 'Quick Delivery', description: 'Under 30 minutes' },
              { icon: '👨‍🍳', title: 'Expert Chefs', description: 'Award-winning' },
            ],
          },
        },
        {
          id: 'products-food',
          type: 'products',
          props: {
            title: 'Popular Dishes',
            limit: 6,
            layout: 'grid',
          },
        },
        {
          id: 'cta-food',
          type: 'cta',
          props: {
            title: 'Hungry? Order Now!',
            description: 'Get 20% off your first order',
            buttonText: 'Order Now',
            buttonLink: '/products',
            backgroundColor: '#ea580c',
            textColor: '#ffffff',
          },
        },
      ],
    },
  },
  
  // 4. Beauty & Cosmetics Template
  {
    name: 'Beauty & Cosmetics',
    category: 'beauty',
    description: 'Elegant, minimalist design for beauty products',
    thumbnail: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=600&fit=crop',
    isDefault: true,
    content: {
      sections: [
        {
          id: 'hero-beauty',
          type: 'hero',
          props: {
            title: 'Discover Your Beauty',
            subtitle: 'Premium skincare and cosmetics',
            backgroundImage: '',
            ctaText: 'Shop Collection',
            ctaLink: '/products',
            textColor: '#ffffff',
            backgroundColor: '#db2777',
          },
        },
        {
          id: 'features-beauty',
          type: 'features',
          props: {
            title: 'Our Promise',
            items: [
              { icon: '🌿', title: 'Natural Ingredients', description: 'Cruelty-free' },
              { icon: '💝', title: 'Luxury Quality', description: 'Premium brands' },
              { icon: '✨', title: 'Expert Advice', description: 'Beauty consultations' },
            ],
          },
        },
        {
          id: 'products-beauty',
          type: 'products',
          props: {
            title: 'Bestsellers',
            limit: 8,
            layout: 'grid',
          },
        },
      ],
    },
  },
  
  // 5. Home & Furniture Template
  {
    name: 'Home & Furniture',
    category: 'home',
    description: 'Clean, spacious layout for furniture and home decor',
    thumbnail: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=600&fit=crop',
    isDefault: true,
    content: {
      sections: [
        {
          id: 'hero-home',
          type: 'hero',
          props: {
            title: 'Transform Your Space',
            subtitle: 'Quality furniture for every room',
            backgroundImage: '',
            ctaText: 'Browse Furniture',
            ctaLink: '/products',
            textColor: '#ffffff',
            backgroundColor: '#059669',
          },
        },
        {
          id: 'features-home',
          type: 'features',
          props: {
            title: 'Why Choose Us',
            items: [
              { icon: '🏠', title: 'Quality Craftsmanship', description: 'Built to last' },
              { icon: '🚚', title: 'White Glove Delivery', description: 'Assembly included' },
              { icon: '💲', title: 'Best Prices', description: 'Price match guarantee' },
            ],
          },
        },
        {
          id: 'products-home',
          type: 'products',
          props: {
            title: 'Featured Furniture',
            limit: 9,
            layout: 'grid',
          },
        },
      ],
    },
  },
  
  // 6. Digital Products/Gift Cards (Purple Cards Style)
  {
    name: 'Digital Products Store',
    category: 'digital',
    description: 'Modern card-based design for digital products and gift cards, inspired by Purple Cards',
    thumbnail: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop',
    isDefault: true,
    content: {
      sections: [
        {
          id: 'hero-digital',
          type: 'hero',
          props: {
            title: 'Your Instant Digital Store',
            subtitle: 'Get your digital products and gift cards instantly',
            backgroundGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            showSearchBar: true,
            searchPlaceholder: 'Search for games, cards, vouchers...',
            ctaText: 'Browse Products',
            ctaLink: '/products',
            textColor: '#ffffff',
            overlayOpacity: 0.7,
          },
        },
        {
          id: 'categories-digital',
          type: 'categoryGrid',
          props: {
            title: 'Shop by Category',
            layout: 'grid',
            columns: 4,
            showIcons: true,
            categories: [
              { name: 'Gaming', icon: '🎮', link: '/category/gaming' },
              { name: 'Mobile Data', icon: '📱', link: '/category/mobile' },
              { name: 'Entertainment', icon: '🎬', link: '/category/entertainment' },
              { name: 'App Stores', icon: '📦', link: '/category/app-stores' },
              { name: 'Voice Chat', icon: '🎤', link: '/category/voice-chat' },
              { name: 'E-Services', icon: '⚡', link: '/category/e-services' },
              { name: 'Delivery', icon: '🚚', link: '/category/delivery' },
              { name: 'Game Console', icon: '🎯', link: '/category/console' },
            ],
          },
        },
        {
          id: 'products-digital',
          type: 'productsWithBadges',
          props: {
            title: 'Featured Products',
            showDiscountBadges: true,
            layout: 'card',
            limit: 12,
            cardStyle: 'modern',
          },
        },
        {
          id: 'testimonials-digital',
          type: 'testimonialsCarousel',
          props: {
            title: 'What Our Customers Say',
            showRatings: true,
            autoPlay: true,
            testimonials: [
              { name: 'Customer 1', rating: 5, comment: 'Fast and reliable service!' },
              { name: 'Customer 2', rating: 5, comment: 'Great prices and instant delivery' },
              { name: 'Customer 3', rating: 5, comment: 'Best digital cards store' },
            ],
          },
        },
        {
          id: 'trust-badges-digital',
          type: 'trustBadges',
          props: {
            badges: [
              { icon: '🔒', text: 'Secure Payment' },
              { icon: '⚡', text: 'Instant Delivery' },
              { icon: '💳', text: 'Multiple Payment Methods' },
              { icon: '🎁', text: 'Loyalty Points' },
            ],
          },
        },
        {
          id: 'footer-digital',
          type: 'footerMultiColumn',
          props: {
            companyName: 'Digital Store',
            columns: [
              {
                title: 'Categories',
                links: [
                  { label: 'Games', url: '/category/games' },
                  { label: 'Mobile Data', url: '/category/mobile' },
                  { label: 'Entertainment', url: '/category/entertainment' },
                ],
              },
              {
                title: 'Help',
                links: [
                  { label: 'FAQ', url: '/faq' },
                  { label: 'Help Center', url: '/help' },
                  { label: 'Contact Us', url: '/contact' },
                ],
              },
              {
                title: 'About',
                links: [
                  { label: 'About Us', url: '/about' },
                  { label: 'Privacy Policy', url: '/privacy' },
                  { label: 'Terms & Conditions', url: '/terms' },
                ],
              },
            ],
            socialLinks: {
              twitter: '',
              facebook: '',
              instagram: '',
            },
          },
        },
      ],
    },
  },
];
