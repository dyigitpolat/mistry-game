from concurrent.futures import ThreadPoolExecutor

from src_py.infrastructure.hf_renderer import HfRenderer, _split_horizontal, _validate_png_base64


class _FakeImage:
    def __init__(self, width: int, height: int) -> None:
        self.size = (width, height)
        self.crops: list[tuple[int, int, int, int]] = []

    def crop(self, box: tuple[int, int, int, int]):
        self.crops.append(box)
        return box


def test_split_horizontal_produces_equal_count() -> None:
    image = _FakeImage(300, 64)
    crops = _split_horizontal(image, 3)
    assert len(crops) == 3
    assert crops[0] == (0, 0, 100, 64)
    assert crops[1] == (100, 0, 200, 64)
    assert crops[2] == (200, 0, 300, 64)


def test_validate_png_base64_accepts_real_png_header() -> None:
    one_px_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAucB9Y6vNisAAAAASUVORK5CYII="
    _validate_png_base64(one_px_png)


def test_hf_renderer_init_is_safe_in_worker_thread() -> None:
    with ThreadPoolExecutor(max_workers=1) as executor:
        renderer = executor.submit(HfRenderer).result()
    assert isinstance(renderer, HfRenderer)
