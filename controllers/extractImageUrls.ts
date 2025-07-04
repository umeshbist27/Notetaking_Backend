export const extractImageUrls = (html = ""): string[] => {
  const matches = html.match(/<img[^>]+src="([^"]+)"/g) || [];

  const urls = matches
    .map((tag) => tag.match(/src="([^"]+)"/)?.[1])
    .filter((url): url is string => typeof url === "string");

  return urls;
};