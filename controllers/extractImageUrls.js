export const extractImageUrls = (html = "") => {
    const matches = html.match(/<img[^>]+src="([^"]+)"/g) || [];
    const urls = matches
        .map((tag) => tag.match(/src="([^"]+)"/)?.[1])
        .filter((url) => typeof url === "string");
    return urls;
};
