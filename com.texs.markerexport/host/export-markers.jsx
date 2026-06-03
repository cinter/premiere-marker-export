// Host-side ExtendScript for the Marker Export CEP panel.
// Entry points called by the panel via evalScript:
//   chooseFolder()                            -> prompts for an export folder
//   choosePreset()                            -> prompts for a .epr (opens in AME Presets)
//   exportMarkersAsClips(folderPath, preset)  -> does the export with those paths
// Uses marker duration if present; otherwise marker-to-next-marker.

// Find the newest "Adobe Media Encoder/<version>/Presets" folder, if any.
function amePresetsDir() {
    var base = new Folder(Folder.myDocuments.fsName + "/Adobe/Adobe Media Encoder");
    if (!base.exists) return null;

    var entries = base.getFiles();
    var best = null;
    var bestVer = -1;

    for (var i = 0; i < entries.length; i++) {
        if (entries[i] instanceof Folder) {
            var ver = parseFloat(entries[i].name);
            var presets = new Folder(entries[i].fsName + "/Presets");
            if (presets.exists && !isNaN(ver) && ver > bestVer) {
                bestVer = ver;
                best = presets;
            }
        }
    }
    return best;
}

function chooseFolder() {
    var outputFolder = Folder.selectDialog("Choose export folder");
    if (!outputFolder) return "CANCELLED";
    return "OK\t" + outputFolder.fsName;
}

function choosePreset() {
    var startDir = amePresetsDir();
    var chosen;

    if (startDir) {
        // An instance openDlg opens the dialog in the file/folder's location,
        // so the user's saved AME presets are right there.
        chosen = (new File(startDir.fsName + "/")).openDlg(
            "Choose Adobe Media Encoder preset (.epr)", "*.epr", false);
    } else {
        chosen = File.openDialog("Choose Adobe Media Encoder preset (.epr)", "*.epr");
    }

    if (!chosen) return "CANCELLED";
    return "OK\t" + chosen.fsName;
}

function exportMarkersAsClips(folderPath, presetPath) {
    var seq = app.project.activeSequence;
    if (!seq) {
        return "ERROR: No active sequence open.";
    }

    if (!folderPath || !presetPath) {
        return "ERROR: Set both an export folder and a preset first.";
    }

    var presetFile = new File(presetPath);
    if (!presetFile.exists) {
        return "ERROR: Preset file not found:\n" + presetPath;
    }
    var outFolder = new Folder(folderPath);
    if (!outFolder.exists) {
        return "ERROR: Export folder not found:\n" + folderPath;
    }

    var markers = seq.markers;
    if (!markers || markers.numMarkers === 0) {
        return "ERROR: No sequence markers found.";
    }

    function safeName(name) {
        if (!name || name === "") name = "marker";
        return name
            .replace(/[\/\\:*?"<>|]/g, "_")
            .replace(/\s+/g, " ")
            .replace(/^\s+|\s+$/g, "");
    }

    function pad(num, size) {
        var s = String(num);
        while (s.length < size) s = "0" + s;
        return s;
    }

    function getMarkerArray() {
        var arr = [];
        var marker = markers.getFirstMarker();
        while (marker) {
            arr.push(marker);
            marker = markers.getNextMarker(marker);
        }
        return arr;
    }

    function markerHasDuration(marker) {
        return marker.end.seconds > marker.start.seconds;
    }

    var markerArray = getMarkerArray();
    var ext = seq.getExportFileExtension(presetFile.fsName);
    if (!ext || ext === "") ext = "mp4";

    app.encoder.launchEncoder();

    var queued = 0;

    for (var i = 0; i < markerArray.length; i++) {
        var m = markerArray[i];

        var inSeconds = m.start.seconds;
        var outSeconds;

        if (markerHasDuration(m)) {
            outSeconds = m.end.seconds;
        } else if (i < markerArray.length - 1) {
            outSeconds = markerArray[i + 1].start.seconds;
        } else {
            // Last plain marker has no next marker, so skip it.
            continue;
        }

        if (outSeconds <= inSeconds) {
            continue;
        }

        seq.setInPoint(inSeconds);
        seq.setOutPoint(outSeconds);

        var markerTitle = m.name || m.comments || "clip";
        var filename = pad(i + 1, 3) + "_" + safeName(markerTitle) + "." + ext;
        var outputPath = outFolder.fsName + "/" + filename;

        // 1 = ENCODE_IN_TO_OUT
        // 1 = remove job from AME queue after completion
        var jobID = app.encoder.encodeSequence(
            seq,
            outputPath,
            presetFile.fsName,
            1,
            1
        );

        if (jobID && jobID !== "0") {
            queued++;
        }
    }

    if (queued > 0) {
        app.encoder.startBatch();
        return "Queued " + queued + " marker export(s) in Adobe Media Encoder.";
    } else {
        return "ERROR: No valid marker ranges found.";
    }
}
