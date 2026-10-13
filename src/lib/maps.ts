/** 주소로 각 지도 서비스의 검색/길찾기 링크를 만듭니다. */
export function mapLinks(address: string) {
  const q = encodeURIComponent(address);
  return {
    // 각 지도에서 주소를 검색해 보여 줍니다. 거기서 '길찾기'를 바로 누를 수 있습니다.
    kakao: `https://map.kakao.com/link/search/${q}`,
    naver: `https://map.naver.com/p/search/${q}`,
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}
