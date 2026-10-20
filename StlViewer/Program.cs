using System.Diagnostics;
using System.Text.Json;
using Microsoft.VisualBasic.FileIO;

var executableFolder = AppContext.BaseDirectory;
var workingFolder = Directory.GetCurrentDirectory();
var contentRoot = Directory.Exists(Path.Combine(executableFolder, "wwwroot")) ? executableFolder :
    Directory.Exists(Path.Combine(workingFolder, "wwwroot")) ? workingFolder :
    Directory.Exists(Path.Combine(workingFolder, "StlViewer", "wwwroot")) ? Path.Combine(workingFolder, "StlViewer") :
    workingFolder;
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = contentRoot });
var portIndex = Array.IndexOf(args, "--port");
var port = 5179;
if (portIndex >= 0 && (portIndex + 1 >= args.Length ||
    !int.TryParse(args[portIndex + 1], out port) || port is < 1 or > 65535))
    throw new ArgumentException("--port wymaga numeru od 1 do 65535.");
builder.WebHost.UseUrls($"http://127.0.0.1:{port}");
var app = builder.Build();
var parentIndex = Array.IndexOf(args, "--parent-pid");
if (parentIndex >= 0)
{
    if (parentIndex + 1 >= args.Length || !int.TryParse(args[parentIndex + 1], out var parentPid) || parentPid <= 0)
        throw new ArgumentException("--parent-pid wymaga poprawnego identyfikatora procesu.");
    _ = Task.Run(async () =>
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync())
        {
            try
            {
                using var parent = Process.GetProcessById(parentPid);
                if (!parent.HasExited) continue;
            }
            catch (ArgumentException) { }
            app.Lifetime.StopApplication();
            break;
        }
    });
}
app.UseDefaultFiles();
app.UseStaticFiles();
var library = new LibraryStore();
var argIndex = Array.IndexOf(args, "--library");
if (argIndex >= 0 && argIndex + 1 < args.Length) library.SetRoot(args[argIndex + 1]);

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api") && context.Request.Method != "GET" &&
        context.Request.Headers["X-Stl-Viewer"] != "1")
    {
        context.Response.StatusCode = 403;
        return;
    }
    await next();
});

app.MapGet("/api/state", () => Results.Ok(new { root = library.Root, slicers = library.Slicers() }));
app.MapGet("/api/list", (string? path) => Safe(() => Results.Ok(library.List(path))));
app.MapGet("/api/folder-samples", (string path) => Safe(() => Results.Ok(library.FolderSamples(path))));
app.MapGet("/api/model", (string path) => Safe(() => Results.File(library.Model(path), "application/octet-stream", enableRangeProcessing: true)));
app.MapPost("/api/library", (PathRequest request) => Safe(() =>
{
    library.SetRoot(request.Path);
    return Results.Ok(new { root = library.Root });
}));
app.MapPost("/api/choose-library", async () => await SafeAsync(async () =>
{
    var path = await PickFolder();
    if (path is null) return Results.NoContent();
    library.SetRoot(path);
    return Results.Ok(new { root = library.Root });
}));
app.MapPost("/api/copy", async (CopyRequest request) => await SafeAsync(async () =>
{
    var source = library.Model(request.Path);
    var targetFolder = request.Destination ?? await PickFolder();
    if (targetFolder is null) return Results.NoContent();
    if (!Directory.Exists(targetFolder)) throw new DirectoryNotFoundException($"Folder nie istnieje: {targetFolder}");
    var name = Path.GetFileNameWithoutExtension(source);
    var target = Path.Combine(targetFolder, Path.GetFileName(source));
    for (var i = 1; File.Exists(target); i++) target = Path.Combine(targetFolder, $"{name} ({i}).stl");
    File.Copy(source, target);
    return Results.Ok(new { path = target });
}));
app.MapPost("/api/trash", async (PathRequest request) => await SafeAsync(async () =>
{
    var source = library.Entry(request.Path);
    if (OperatingSystem.IsWindows())
    {
        if (Directory.Exists(source))
            FileSystem.DeleteDirectory(source, UIOption.OnlyErrorDialogs, RecycleOption.SendToRecycleBin);
        else FileSystem.DeleteFile(source, UIOption.OnlyErrorDialogs, RecycleOption.SendToRecycleBin);
    }
    else if (OperatingSystem.IsLinux())
    {
        var result = await Run("gio", ["trash", source]);
        if (result.Code != 0) throw new IOException(result.Error.Trim());
    }
    else throw new PlatformNotSupportedException("Kosz jest obsługiwany na Linux i Windows.");
    return Results.Ok();
}));
app.MapPost("/api/slicer", (SlicerRequest request) => Safe(() =>
{
    var source = library.Model(request.Path);
    var slicer = library.Slicers().FirstOrDefault(x => x.Id == request.SlicerId)
        ?? throw new ArgumentException("Nieznany slicer.");
    var info = new ProcessStartInfo(slicer.Executable) { UseShellExecute = false };
    info.ArgumentList.Add(source);
    Process.Start(info);
    return Results.Ok();
}));
app.MapPost("/api/custom-slicer", (PathRequest request) => Safe(() =>
{
    library.AddSlicer(request.Path);
    return Results.Ok(library.Slicers());
}));
app.MapPost("/api/rename", (RenameRequest request) => Safe(() => Results.Ok(new { path = library.Rename(request.Path, request.NewName) })));
app.MapPost("/api/paste", (PasteRequest request) => Safe(() => Results.Ok(new { path = library.Paste(request.Path, request.Destination, request.Move) })));

if (!args.Contains("--no-browser"))
    app.Lifetime.ApplicationStarted.Register(() =>
    {
        try
        {
            var url = $"http://127.0.0.1:{port}";
            if (OperatingSystem.IsWindows()) Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            else Process.Start(new ProcessStartInfo("xdg-open", url) { UseShellExecute = false });
        }
        catch (Exception error) { Console.Error.WriteLine($"Otwórz http://127.0.0.1:{port} ({error.Message})"); }
    });
app.Run();

static IResult Safe(Func<IResult> action)
{
    try { return action(); }
    catch (Exception e) when (e is IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException or PlatformNotSupportedException or System.ComponentModel.Win32Exception)
    { return Results.BadRequest(new { error = e.Message }); }
}
static async Task<IResult> SafeAsync(Func<Task<IResult>> action)
{
    try { return await action(); }
    catch (Exception e) when (e is IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException or PlatformNotSupportedException or System.ComponentModel.Win32Exception)
    { return Results.BadRequest(new { error = e.Message }); }
}
static async Task<string?> PickFolder()
{
    (int Code, string Output, string Error) result;
    if (OperatingSystem.IsWindows())
    {
        const string script = "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Wybierz folder'; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::WriteLine($dialog.SelectedPath) }";
        result = await Run("powershell.exe", ["-NoProfile", "-STA", "-Command", script]);
    }
    else if (OperatingSystem.IsLinux())
    {
        try { result = await Run("zenity", ["--file-selection", "--directory", "--title=Wybierz folder"]); }
        catch (System.ComponentModel.Win32Exception) { result = await Run("kdialog", ["--getexistingdirectory", "."]); }
    }
    else throw new PlatformNotSupportedException("Wybór folderu jest obsługiwany na Linux i Windows.");
    return result.Code == 0 && !string.IsNullOrWhiteSpace(result.Output) ? result.Output.Trim() : null;
}
static async Task<(int Code, string Output, string Error)> Run(string program, IEnumerable<string> arguments)
{
    using var process = new Process { StartInfo = new ProcessStartInfo(program)
    { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false } };
    foreach (var argument in arguments) process.StartInfo.ArgumentList.Add(argument);
    process.Start();
    var output = process.StandardOutput.ReadToEndAsync();
    var error = process.StandardError.ReadToEndAsync();
    await process.WaitForExitAsync();
    return (process.ExitCode, await output, await error);
}
record PathRequest(string Path);
record CopyRequest(string Path, string? Destination);
record RenameRequest(string Path, string NewName);
record PasteRequest(string Path, string Destination, bool Move);
record SlicerRequest(string Path, string SlicerId);
record Slicer(string Id, string Name, string Executable);

sealed class LibraryStore
{
    private readonly string configFile;
    private Config config;
    public string? Root => config.Root;
    public LibraryStore()
    {
        var folder = Environment.GetEnvironmentVariable("STLV_CONFIG_DIR") ??
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "stl-viewer");
        configFile = Path.Combine(folder, "settings.json");
        try { config = JsonSerializer.Deserialize<Config>(File.ReadAllText(configFile)) ?? new(); }
        catch (IOException) { config = new(); }
        catch (JsonException) { config = new(); }
        if (config.Root is not null && !Directory.Exists(config.Root)) config.Root = null;
    }
    public void SetRoot(string path)
    {
        path = Path.GetFullPath(path);
        if (!Directory.Exists(path)) throw new DirectoryNotFoundException($"Folder nie istnieje: {path}");
        config.Root = path;
        Save();
    }
    public object[] List(string? path)
    {
        var folder = Check(path ?? Root ?? throw new InvalidOperationException("Najpierw wybierz bibliotekę."));
        if (!Directory.Exists(folder)) throw new DirectoryNotFoundException(folder);
        return Directory.EnumerateFileSystemEntries(folder)
            .Where(p => !IsLink(p) && (Directory.Exists(p) || Path.GetExtension(p).Equals(".stl", StringComparison.OrdinalIgnoreCase)))
            .OrderBy(p => Directory.Exists(p) ? 0 : 1)
            .ThenBy(p => Path.GetFileName(p), StringComparer.CurrentCultureIgnoreCase)
            .Select(p => (object)new { path = p, name = Path.GetFileName(p), folder = Directory.Exists(p) }).ToArray();
    }
    public string[] FolderSamples(string path)
    {
        var root = Check(path);
        if (!Directory.Exists(root)) throw new DirectoryNotFoundException(root);
        var samples = new List<string>(4);
        var pending = new Stack<(string Path, int Depth)>();
        pending.Push((root, 0));
        var seen = 0;
        var examined = 0;
        while (pending.Count > 0 && examined < 2000)
        {
            var (folder, depth) = pending.Pop();
            try
            {
                foreach (var entry in Directory.EnumerateFileSystemEntries(folder))
                {
                    if (++examined > 2000) break;
                    if (IsLink(entry)) continue;
                    if (Directory.Exists(entry))
                    {
                        if (depth < 10) pending.Push((entry, depth + 1));
                        continue;
                    }
                    if (!Path.GetExtension(entry).Equals(".stl", StringComparison.OrdinalIgnoreCase)) continue;
                    seen++;
                    if (samples.Count < 4) samples.Add(entry);
                    else
                    {
                        var replace = Random.Shared.Next(seen);
                        if (replace < 4) samples[replace] = entry;
                    }
                }
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
        return samples.ToArray();
    }
    public string Model(string path)
    {
        var file = Check(path);
        if (!Path.GetExtension(file).Equals(".stl", StringComparison.OrdinalIgnoreCase) || !File.Exists(file))
            throw new FileNotFoundException("Nie znaleziono pliku STL.");
        return file;
    }
    public string Entry(string path)
    {
        var entry = Check(path);
        if (entry == Root) throw new ArgumentException("Nie można zmienić całej biblioteki.");
        if (Directory.Exists(entry)) return entry;
        if (File.Exists(entry) && Path.GetExtension(entry).Equals(".stl", StringComparison.OrdinalIgnoreCase)) return entry;
        throw new FileNotFoundException("Nie znaleziono pliku STL ani folderu.");
    }
    public string Paste(string path, string destination, bool move)
    {
        var source = Entry(path);
        var folder = Check(destination);
        if (!Directory.Exists(folder)) throw new DirectoryNotFoundException($"Folder nie istnieje: {folder}");
        var isFolder = Directory.Exists(source);
        if (isFolder && (folder == source || folder.StartsWith(source.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.Ordinal)))
            throw new ArgumentException("Nie można wkleić folderu do niego samego ani do jego podfolderu.");
        if (move && Path.GetDirectoryName(source) == folder) return source;
        var target = UniqueTarget(folder, Path.GetFileName(source), isFolder);
        if (move)
        {
            if (isFolder) Directory.Move(source, target);
            else File.Move(source, target);
            return target;
        }
        if (isFolder) EnsureNoLinks(source);
        var temporary = Path.Combine(folder, ".stl-viewer-copy-" + Guid.NewGuid().ToString("N"));
        try
        {
            if (isFolder)
            {
                CopyFolder(source, temporary);
                Directory.Move(temporary, target);
            }
            else
            {
                File.Copy(source, temporary);
                File.Move(temporary, target);
            }
        }
        catch
        {
            if (Directory.Exists(temporary)) Directory.Delete(temporary, recursive: true);
            else if (File.Exists(temporary)) File.Delete(temporary);
            throw;
        }
        return target;
    }
    private static string UniqueTarget(string folder, string name, bool isFolder)
    {
        var stem = isFolder ? name : Path.GetFileNameWithoutExtension(name);
        var extension = isFolder ? "" : Path.GetExtension(name);
        var target = Path.Combine(folder, name);
        for (var i = 1; File.Exists(target) || Directory.Exists(target); i++)
            target = Path.Combine(folder, $"{stem} ({i}){extension}");
        return target;
    }
    private static void EnsureNoLinks(string folder)
    {
        foreach (var entry in Directory.EnumerateFileSystemEntries(folder))
        {
            if (IsLink(entry)) throw new UnauthorizedAccessException("Folder zawiera link symboliczny. Nie można go skopiować.");
            if (Directory.Exists(entry)) EnsureNoLinks(entry);
        }
    }
    private static void CopyFolder(string source, string target)
    {
        Directory.CreateDirectory(target);
        foreach (var entry in Directory.EnumerateFileSystemEntries(source))
        {
            if (IsLink(entry)) throw new UnauthorizedAccessException("Folder zawiera link symboliczny. Nie można go skopiować.");
            var child = Path.Combine(target, Path.GetFileName(entry));
            if (Directory.Exists(entry)) CopyFolder(entry, child);
            else File.Copy(entry, child);
        }
    }
    public string Rename(string path, string newName)
    {
        var source = Entry(path);
        var isFolder = Directory.Exists(source);
        newName = newName.Trim();
        if (!isFolder && newName.EndsWith(".stl", StringComparison.OrdinalIgnoreCase))
            newName = newName[..^4];
        if (string.IsNullOrWhiteSpace(newName) || newName is "." or ".." || newName.Length > 240 ||
            newName.EndsWith('.') || newName.EndsWith(' ') ||
            newName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 ||
            newName.Any(c => c < 32 || c is '<' or '>' or ':' or '"' or '/' or '\\' or '|' or '?' or '*') ||
            IsWindowsReservedName(newName))
            throw new ArgumentException("Nieprawidłowa nazwa pliku.");
        var target = Path.Combine(Path.GetDirectoryName(source)!, newName + (isFolder ? "" : ".stl"));
        if (source == target) return source;
        if ((File.Exists(target) || Directory.Exists(target)) && !source.Equals(target, StringComparison.OrdinalIgnoreCase))
            throw new IOException("Plik o tej nazwie już istnieje.");
        if (isFolder) Directory.Move(source, target);
        else File.Move(source, target);
        return target;
    }
    private static bool IsWindowsReservedName(string name)
    {
        var stem = name.Split('.')[0].ToUpperInvariant();
        return stem is "CON" or "PRN" or "AUX" or "NUL" or
            "COM1" or "COM2" or "COM3" or "COM4" or "COM5" or "COM6" or "COM7" or "COM8" or "COM9" or
            "LPT1" or "LPT2" or "LPT3" or "LPT4" or "LPT5" or "LPT6" or "LPT7" or "LPT8" or "LPT9";
    }
    private string Check(string path)
    {
        var root = Root ?? throw new InvalidOperationException("Najpierw wybierz bibliotekę.");
        var full = Path.GetFullPath(path);
        if (full != root && !full.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw new UnauthorizedAccessException("Plik jest poza biblioteką.");
        for (var current = full; current != root; current = Path.GetDirectoryName(current)!)
            if (IsLink(current)) throw new UnauthorizedAccessException("Linki symboliczne w bibliotece nie są obsługiwane.");
        return full;
    }
    private static bool IsLink(string path) => (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0;
    public List<Slicer> Slicers()
    {
        var known = new (string Name, string[] Commands)[]
        {
            ("OrcaSlicer", ["orca-slicer", "OrcaSlicer"]),
            ("Ultimaker Cura", ["cura", "Cura"]),
            ("Anycubic Slicer", ["anycubic-slicer", "AnycubicSlicer"]),
            ("PrusaSlicer", ["prusa-slicer"]),
            ("Bambu Studio", ["bambu-studio"])
        };
        var found = new List<Slicer>();
        foreach (var (name, commands) in known)
        {
            var exe = commands.Select(FindOnPath).FirstOrDefault(x => x is not null);
            if (exe is not null) found.Add(new Slicer(name, name, exe));
        }
        foreach (var custom in config.CustomSlicers.Where(File.Exists))
            found.Add(new Slicer(custom, Path.GetFileName(custom), custom));
        return found;
    }
    public void AddSlicer(string path)
    {
        path = Path.GetFullPath(path);
        if (!File.Exists(path)) throw new FileNotFoundException("Nie znaleziono programu slicera.");
        if (!config.CustomSlicers.Contains(path)) config.CustomSlicers.Add(path);
        Save();
    }
    private static string? FindOnPath(string command)
    {
        if (OperatingSystem.IsWindows() && !Path.HasExtension(command)) command += ".exe";
        foreach (var directory in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            if (string.IsNullOrWhiteSpace(directory)) continue;
            var path = Path.Combine(directory, command);
            if (File.Exists(path)) return path;
        }
        return null;
    }
    private void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(configFile)!);
        File.WriteAllText(configFile, JsonSerializer.Serialize(config));
    }
    private sealed class Config
    {
        public Config() { }
        public string? Root { get; set; }
        public List<string> CustomSlicers { get; set; } = [];
    }
}
