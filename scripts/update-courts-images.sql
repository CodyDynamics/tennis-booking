-- Update all courts with online image URLs and map embed
-- Run this in DBeaver (or any PostgreSQL client) to fill imageUrl, imageGallery, mapEmbedUrl

-- Tennis courts
UPDATE courts
SET
  "imageUrl" = 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200&q=80',
  "imageGallery" = '["https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1200&q=80","https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=1200&q=80","https://images.unsplash.com/photo-1595435933710-d7bfb0f5611a?w=1200&q=80","https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80"]',
  "mapEmbedUrl" = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.184052889387!2d-73.987844684286!3d40.748440979326!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1234567890'
WHERE sport = 'tennis';

-- Pickleball courts
UPDATE courts
SET
  "imageUrl" = 'https://images.unsplash.com/photo-1622163642998-1ea32a664d18?w=1200&q=80',
  "imageGallery" = '["https://images.unsplash.com/photo-1622163642998-1ea32a664d18?w=1200&q=80","https://images.unsplash.com/photo-1611916656173-875e4277bea6?w=1200&q=80"]',
  "mapEmbedUrl" = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.184052889387!2d-73.987844684286!3d40.748440979326!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1234567890'
WHERE sport = 'pickleball';
