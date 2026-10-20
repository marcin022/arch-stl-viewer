# STL Viewer

Lokalna aplikacja do przeglądania folderu z modelami STL. Po lewej stronie ma drzewo folderów i plików, po prawej obracany podgląd modelu, jego wymiary i liczbę trójkątów. Obsługuje STL binarny i tekstowy. Na Linuksie otwiera własne okno GTK z wbudowanym WebKit; przeglądarka internetowa nie jest potrzebna. Interfejs nadal korzysta z HTML i WebGL, a lokalna usługa .NET uruchamia się razem z oknem i zamyka po jego zamknięciu.

Kod projektu jest udostępniany na licencji [GNU GPL 3.0](LICENSE), wyłącznie w wersji 3 (`GPL-3.0-only`).

## Uruchomienie

Do uruchomienia **ze źródeł** na Linuksie potrzebne są .NET SDK 10, Python 3 z PyGObject, GTK 3 i WebKitGTK 4.1. Na Arch Linux są to pakiety `python-gobject`, `gtk3` i `webkit2gtk-4.1`. Wybór folderu korzysta z `zenity` lub `kdialog`, a kosz z `gio`. Aplikacja nie pobiera bibliotek NuGet.

```bash
git clone https://github.com/marcin022/arch-stl-viewer.git
cd arch-stl-viewer
./uruchom.sh
```

Na Windows obecna paczka nadal otwiera interfejs w przeglądarce. Launcher desktopowy jest obecnie przygotowany dla Linuksa.

Otworzy się okno **STL Viewer**. Nie trzeba wpisywać adresu ani osobno uruchamiać usługi. Można zamknąć program krzyżykiem okna lub Ctrl+C w terminalu. Usługa nasłuchuje wyłącznie na komputerze lokalnym na losowym wolnym porcie.

Na KDE/Wayland z kartą NVIDIA launcher ustawia `__NV_DISABLE_EXPLICIT_SYNC=1` tylko dla siebie i uruchomionej usługi. Zapobiega to awarii WebKitGTK z komunikatem `Error 71 (Protocol error)`. Nie zmienia ustawień systemu ani sterownika. Jeśli okno zamknie się mimo tego, uruchom skrypt w terminalu i zachowaj końcowe linie komunikatów.

Możesz od razu wskazać bibliotekę:

```bash
./uruchom.sh --library /pełna/ścieżka/do/modeli
```

Folder można także wybrać przyciskiem w aplikacji. Jeżeli okno systemowe wyboru folderu jest niedostępne, aplikacja wyświetli pole na pełną ścieżkę.

## Obsługa

- Kliknij folder po lewej, aby go rozwinąć. Kliknij STL, aby zobaczyć podgląd.
- Przełącznik nad lewym panelem wybiera listę albo siatkę. W siatce pliki mają miniatury rysowane z całej siatki STL z uwzględnieniem głębi, a foldery pokazują do czterech losowo wybranych modeli także z podfolderów. Kliknij folder, aby wejść do środka; strzałka nad siatką wraca poziom wyżej. Miniatury wczytują się podczas przewijania.
- Kliknij prawym przyciskiem plik lub folder w liście albo siatce, aby zmienić nazwę, skopiować, wyciąć, wkleić lub przenieść do Kosza. Wklejenie na folderze umieszcza element w tym folderze; wklejenie na pustym miejscu umieszcza go w bieżącym folderze. Kopiuj/wytnij/wklej działa w obrębie aplikacji i wybranej biblioteki. Kopie dostają numer w nazwie, jeśli taka nazwa już istnieje.
- Przeciągaj model myszą, aby go obrócić. Rolka i przyciski `+` / `−` zmieniają powiększenie.
- **Zmień nazwę** zmienia nazwę wybranego pliku w bibliotece i zachowuje rozszerzenie `.stl`. Aplikacja odrzuca nieprawidłowe nazwy i nie nadpisuje istniejącego pliku.
- **Kopiuj** otwiera wybór folderu docelowego. Gdy plik o tej nazwie już istnieje, kopia dostaje numer w nazwie.
- **Do kosza** po potwierdzeniu przenosi plik do Kosza systemowego. Nie usuwa go bezpowrotnie. Po usunięciu otwartego modelu podgląd przechodzi do następnego widocznego pliku STL (lub poprzedniego, gdy był ostatni), zachowując rozwinięte foldery i pozycję listy.
- Lista slicerów wykrywa programy w `PATH`: OrcaSlicer, Cura, Anycubic Slicer, PrusaSlicer i Bambu Studio. Przyciskiem `+` można podać pełną ścieżkę do innego programu lub AppImage. Slicer dostaje ścieżkę wybranego STL jako argument.

Ustawienia zapisują się w folderze danych aplikacji użytkownika (`~/.config/stl-viewer` na typowym Linuksie, `%APPDATA%\stl-viewer` na Windows) albo w folderze wskazanym przez `STLV_CONFIG_DIR`.

## Paczki do dystrybucji

### Arch Linux

Lokalną paczkę dla Archa zbudujesz poleceniem `./packaging/arch/build-local.sh`. Gotowy plik `stl-viewer-0.1.0-1-x86_64.pkg.tar.zst` pojawi się w `dist/`. Pakiet instaluje polecenie `stl-viewer` oraz wpis w menu aplikacji. Do uruchomienia korzysta z systemowych pakietów .NET, Python, GTK i WebKitGTK.

Lokalną paczkę zainstalujesz poleceniem `sudo pacman -U dist/stl-viewer-0.1.0-1-x86_64.pkg.tar.zst`. Po instalacji uruchom **STL Viewer** z menu aplikacji albo wpisz `stl-viewer` w terminalu. Skrypt `uruchom.sh` służy do uruchamiania projektu bez instalacji.

[PKGBUILD](packaging/arch/PKGBUILD) wskazuje repozytorium `marcin022/arch-stl-viewer` i przyszły tag `v0.1.0`. Przed zgłoszeniem do AUR trzeba opublikować ten tag, wpisać sumę SHA-256 archiwum pobranego z GitHub w miejsce `SKIP` oraz wygenerować `.SRCINFO`.

### Archiwa Linux i Windows

Plik [package.yml](.github/workflows/package.yml) buduje dwa archiwa: `STL-Viewer-linux-x64.tar.gz` i `STL-Viewer-win-x64.zip`. Każde zawiera aplikację i runtime .NET 10. Paczka linuksowa zawiera także launcher okna; system odbiorcy musi mieć Python 3, PyGObject, GTK 3 i WebKitGTK 4.1. Do wyboru folderu potrzebne jest `zenity` lub `kdialog`, a do kosza `gio`. Paczka Windows nadal wymaga przeglądarki.

Po umieszczeniu projektu w repozytorium GitHub wejdź w **Actions → Paczki Linux i Windows → Run workflow**. Archiwa pojawią się w artefaktach zakończonego przebiegu. Workflow uruchamia się też po wypchnięciu tagu zaczynającego się od `v`. Nie publikuje automatycznie wydania.

Odbiorca Windows rozpakowuje ZIP i uruchamia `StlViewer.exe`. Odbiorca Linuksa rozpakowuje `tar.gz` i uruchamia `./uruchom.sh`. Trzeba zachować całą zawartość archiwum razem z folderem `wwwroot`; sam plik wykonywalny nie zawiera interfejsu.

Podgląd korzysta z WebGL i wyświetla wszystkie trójkąty pliku STL z testem głębi. Duże pliki mogą wymagać więcej pamięci karty graficznej i czasu wczytywania. Wymiary i liczba trójkątów dotyczą całego pliku; podgląd nie służy do oceny poprawności siatki ani przygotowania wydruku.
