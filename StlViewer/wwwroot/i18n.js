const messages = {
  en: {
    local: 'LOCAL', chooseLibrary: 'Choose library', listView: 'List view', gridView: 'Grid view', libraryView: 'Library view', refresh: 'Refresh library', noLibrary: 'No library', chooseFolderHint: 'Choose a folder with STL models', parentFolder: 'Parent folder', modelPreview: 'MODEL PREVIEW', chooseModel: 'Choose a model from the library', rename: 'Rename', copy: 'Copy', trash: 'To Trash', renameFileTitle: 'Rename STL file', copyFileTitle: 'Copy file to another folder', trashFileTitle: 'Move file to Trash', emptyTitle: 'Your space for models', emptyDescription: 'Choose a library and click an STL file on the left to preview it here.', chooseFolder: 'Choose folder →', centerModel: 'Center model', zoomIn: 'Zoom in', zoomOut: 'Zoom out', viewHint: 'DRAG TO ROTATE · SCROLL TO ZOOM', dimensions: 'DIMENSIONS', triangles: 'TRIANGLES', format: 'FORMAT', chooseSlicer: 'Choose slicer', addSlicerTitle: 'Add a slicer program or AppImage', openSlicer: 'Open in slicer ↗', contextLabel: 'File or folder actions', cut: 'Cut', paste: 'Paste', delete: 'Move to Trash', chooseLibraryTitle: 'Choose library', chooseLibraryDescription: 'Enter the full path to a folder containing STL models.', libraryPlaceholder: '/home/user/Models', cancel: 'Cancel', openFolder: 'Open folder', addSlicer: 'Add slicer', addSlicerDescription: 'Enter the full path to a program or AppImage. It must be executable.', slicerPlaceholder: '/home/user/Downloads/OrcaSlicer.AppImage', add: 'Add', renameModel: 'Rename model', renameFolder: 'Rename folder', renameHint: 'Enter a new name. The .stl extension will be preserved.', renameFolderHint: 'Enter a new folder name.', saveName: 'Save name', languageTitle: 'Switch to Polish', noFiles: 'No STL files', allModels: 'All models', emptyGrid: 'This folder contains no STL models or subfolders.', loadingModel: 'Loading model…', folder: 'folder', model: 'model', copied: 'Copied', cutDone: 'Cut', moved: 'Moved', clipboardHint: '{action}: {name}. Choose a folder and use “Paste”.', pastedTo: '{action} to: {path}', confirmTrash: 'Move {type} “{name}” to Trash?', movedToTrash: 'Moved to Trash.', renamed: '{type} renamed.', copyDestination: 'Enter the full path to the destination folder:', copiedTo: 'Copied to: {path}', folderType: 'Folder', modelType: 'Model', folderPickerUnavailable: 'The system folder picker is unavailable. Enter the path.', slicerAdded: 'Slicer added.', chooseSlicerError: 'Choose a slicer from the list.', slicerStarted: 'Slicer started.', httpError: 'HTTP error {status}', binaryStl: 'BINARY STL', asciiStl: 'ASCII STL', incompleteTriangle: 'Invalid STL file: incomplete triangle.', invalidCoordinates: 'The model contains invalid coordinates.', noTriangles: 'The STL file contains no triangles.', previewError: '3D preview error', webglRequired: '3D preview requires WebGL. Enable graphics acceleration.', outOfMemory: 'Not enough memory to preview the model.', gpuUploadFailed: 'Could not upload the model to the GPU.', invalidStlCoordinates: 'Invalid STL coordinates.', emptyStl: 'Empty STL file.'
  },
  pl: {
    local: 'LOKALNIE', chooseLibrary: 'Wybierz bibliotekę', listView: 'Widok listy', gridView: 'Widok siatki', libraryView: 'Widok biblioteki', refresh: 'Odśwież bibliotekę', noLibrary: 'Brak biblioteki', chooseFolderHint: 'Wybierz folder z modelami STL', parentFolder: 'Folder wyżej', modelPreview: 'PODGLĄD MODELU', chooseModel: 'Wybierz model z biblioteki', rename: 'Zmień nazwę', copy: 'Kopiuj', trash: 'Do kosza', renameFileTitle: 'Zmień nazwę pliku STL', copyFileTitle: 'Skopiuj plik do innego folderu', trashFileTitle: 'Przenieś plik do kosza', emptyTitle: 'Twoja przestrzeń na modele', emptyDescription: 'Wybierz bibliotekę i kliknij plik STL po lewej, aby zobaczyć go tutaj.', chooseFolder: 'Wybierz folder →', centerModel: 'Wycentruj model', zoomIn: 'Przybliż', zoomOut: 'Oddal', viewHint: 'PRZECIĄGNIJ, ABY OBRÓCIĆ · ROLKA, ABY PRZYBLIŻYĆ', dimensions: 'WYMIARY', triangles: 'TRÓJKĄTY', format: 'FORMAT', chooseSlicer: 'Wybierz slicer', addSlicerTitle: 'Dodaj program lub AppImage slicera', openSlicer: 'Otwórz w slicerze ↗', contextLabel: 'Operacje na pliku lub folderze', cut: 'Wytnij', paste: 'Wklej', delete: 'Usuń do Kosza', chooseLibraryTitle: 'Wybierz bibliotekę', chooseLibraryDescription: 'Podaj pełną ścieżkę do folderu z modelami STL.', libraryPlaceholder: '/home/użytkownik/Modele', cancel: 'Anuluj', openFolder: 'Otwórz folder', addSlicer: 'Dodaj slicer', addSlicerDescription: 'Podaj pełną ścieżkę do programu lub pliku AppImage. Musi mieć uprawnienie do uruchamiania.', slicerPlaceholder: '/home/użytkownik/Downloads/OrcaSlicer.AppImage', add: 'Dodaj', renameModel: 'Zmień nazwę modelu', renameFolder: 'Zmień nazwę folderu', renameHint: 'Podaj nową nazwę. Rozszerzenie .stl zostanie zachowane.', renameFolderHint: 'Podaj nową nazwę folderu.', saveName: 'Zapisz nazwę', languageTitle: 'Switch to English', noFiles: 'Brak plików STL', allModels: 'Wszystkie modele', emptyGrid: 'Ten folder nie zawiera modeli STL ani podfolderów.', loadingModel: 'Wczytywanie modelu…', folder: 'folder', model: 'model', copied: 'Skopiowano', cutDone: 'Wycięto', moved: 'Przeniesiono', clipboardHint: '{action}: {name}. Wybierz folder i użyj „Wklej”.', pastedTo: '{action} do: {path}', confirmTrash: 'Przenieść {type} „{name}” do Kosza?', movedToTrash: 'Przeniesiono do Kosza.', renamed: '{type} ma nową nazwę.', copyDestination: 'Podaj pełną ścieżkę do folderu docelowego:', copiedTo: 'Skopiowano do: {path}', folderType: 'Folder', modelType: 'Model', folderPickerUnavailable: 'Wybór folderu przez system jest niedostępny. Wpisz ścieżkę.', slicerAdded: 'Dodano slicer.', chooseSlicerError: 'Wybierz slicer z listy.', slicerStarted: 'Uruchomiono slicer.', httpError: 'Błąd HTTP {status}', binaryStl: 'BINARNY STL', asciiStl: 'TEKSTOWY STL', incompleteTriangle: 'Nieprawidłowy plik STL: niepełny trójkąt.', invalidCoordinates: 'Model zawiera nieprawidłowe współrzędne.', noTriangles: 'Plik STL nie zawiera trójkątów.', previewError: 'Błąd podglądu 3D', webglRequired: 'Podgląd 3D wymaga WebGL. Włącz akcelerację grafiki.', outOfMemory: 'Brak pamięci na podgląd modelu.', gpuUploadFailed: 'Nie udało się przesłać modelu do karty graficznej.', invalidStlCoordinates: 'Nieprawidłowe współrzędne STL.', emptyStl: 'Pusty plik STL.'
  }
};
function savedLanguage() { try { return localStorage.getItem('stl-viewer-language') === 'pl' ? 'pl' : 'en'; } catch { return 'en'; } }
let language = savedLanguage();
function t(key, values = {}) {
  return (messages[language][key] || messages.en[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}
function applyLanguage() {
  document.documentElement.lang = language;
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll('[data-i18n-title]')) element.title = t(element.dataset.i18nTitle);
  for (const element of document.querySelectorAll('[data-i18n-aria]')) element.setAttribute('aria-label', t(element.dataset.i18nAria));
  for (const element of document.querySelectorAll('[data-i18n-placeholder]')) element.placeholder = t(element.dataset.i18nPlaceholder);
  const button = document.getElementById('languageButton');
  button.textContent = language === 'en' ? '🇬🇧' : '🇵🇱';
  button.title = t('languageTitle');
  button.setAttribute('aria-label', t('languageTitle'));
  button.setAttribute('aria-pressed', String(language === 'pl'));
}
function setLanguage(next) {
  language = next === 'pl' ? 'pl' : 'en';
  try { localStorage.setItem('stl-viewer-language', language); } catch { }
  applyLanguage();
}
const serverErrors = new Map([
  ['Najpierw wybierz bibliotekę.', 'Choose a library first.'],
  ['Nie znaleziono pliku STL.', 'STL file not found.'],
  ['Nie można zmienić całej biblioteki.', 'The library itself cannot be changed.'],
  ['Nie znaleziono pliku STL ani folderu.', 'STL file or folder not found.'],
  ['Nie można wkleić folderu do niego samego ani do jego podfolderu.', 'A folder cannot be pasted into itself or its subfolder.'],
  ['Folder zawiera link symboliczny. Nie można go skopiować.', 'The folder contains a symbolic link and cannot be copied.'],
  ['Nieprawidłowa nazwa pliku.', 'Invalid file name.'],
  ['Plik o tej nazwie już istnieje.', 'A file with this name already exists.'],
  ['Plik jest poza biblioteką.', 'The file is outside the library.'],
  ['Linki symboliczne w bibliotece nie są obsługiwane.', 'Symbolic links in the library are not supported.'],
  ['Nie znaleziono programu slicera.', 'Slicer program not found.'],
  ['Nieznany slicer.', 'Unknown slicer.'],
  ['Kosz jest obsługiwany na Linux i Windows.', 'Trash is supported on Linux and Windows.'],
  ['Wybór folderu jest obsługiwany na Linux i Windows.', 'Folder selection is supported on Linux and Windows.']
]);
function localizeServerError(message) {
  if (!message || language === 'pl') return message;
  if (message.startsWith('Folder nie istnieje: ')) return 'Folder does not exist: ' + message.slice('Folder nie istnieje: '.length);
  return serverErrors.get(message) || message;
}
