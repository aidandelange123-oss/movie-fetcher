// Import required modules
import fetch from 'node-fetch';
import cheerio from 'cheerio';

// Main handler for the Vercel serverless function
export default async function handler(req, res) {
  try {
    // Check if the request method is GET
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the movie ID and format from the query parameters
    const { id, format = 'm3u8' } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Movie ID is required' });
    }

    // Validate the format parameter
    if (!['m3u8', 'mp4'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use m3u8 or mp4' });
    }

    // Scrape Vidsrc for the movie
    const movieData = await scrapeVidsrc(id, format);

    // Return the scraped data
    res.status(200).json(movieData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Function to scrape Vidsrc
async function scrapeVidsrc(movieId, format) {
  try {
    // Construct the Vidsrc URL
    const url = `https://vidsrc.to/embed/movie/${movieId}`;

    // Fetch the HTML content
    const response = await fetch(url);
    const html = await response.text();

    // Load the HTML into Cheerio
    const $ = cheerio.load(html);

    // Extract the necessary data
    const title = $('title').text();
    const iframeSrc = $('iframe').attr('src');

    // Get the video stream URL based on the requested format
    const streamUrl = await getStreamUrl(iframeSrc, format);

    // Return the scraped data
    return {
      title,
      streamUrl,
      format,
      originalUrl: url
    };
  } catch (error) {
    console.error('Error scraping Vidsrc:', error);
    throw error;
  }
}

// Function to get the appropriate stream URL based on format
async function getStreamUrl(iframeSrc, format) {
  try {
    // Fetch the iframe content
    const iframeResponse = await fetch(iframeSrc);
    const iframeHtml = await iframeResponse.text();

    // Load the iframe HTML into Cheerio
    const $iframe = cheerio.load(iframeHtml);

    // Extract the video source based on the requested format
    let streamUrl;

    if (format === 'm3u8') {
      // For m3u8 format, look for the HLS stream
      streamUrl = $iframe('source[type="application/x-mpegURL"]').attr('src');
    } else if (format === 'mp4') {
      // For mp4 format, look for the MP4 stream
      streamUrl = $iframe('source[type="video/mp4"]').attr('src');
    }

    // If no direct source found, try to extract from JavaScript
    if (!streamUrl) {
      const scriptContent = $iframe('script').html();
      const match = scriptContent.match(/"(https?:\/\/[^"]+\.(m3u8|mp4))"/i);
      if (match) {
        streamUrl = match[1];
      }
    }

    if (!streamUrl) {
      throw new Error('Could not find video stream URL');
    }

    return streamUrl;
  } catch (error) {
    console.error('Error getting stream URL:', error);
    throw error;
  }
}
