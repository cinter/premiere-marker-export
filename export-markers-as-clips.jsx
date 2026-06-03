// Export individual clips from Premiere sequence markers
// Uses marker duration if present; otherwise marker-to-next-marker.
//
// NOTE: Premiere Pro has no "Run Script File" menu. To run this standalone,
// use Adobe's VS Code ExtendScript Debugger extension targeting Premiere Pro.
// For a one-click button inside Premiere, install the CEP panel in
// com.texs.markerexport/ instead (see README).

(function () {
    var seq = app.project.activeSequence;

    if (!seq) {
        alert("No active sequence open.");
        return;
    }

    var outputFolder = Folder.selectDialog("Choose export folder");
    if (!outputFolder) return;

    var presetFile = File.openDialog("Choose Adobe Media Encoder preset (.epr)", "*.epr");
    if (!presetFile) return;

    var markers = seq.markers;
    if (!markers || markers.numMarkers === 0) {
        alert("No sequence markers found.");
        return;
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
        var outputPath = outputFolder.fsName + "/" + filename;

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
        alert("Queued " + queued + " marker exports in Adobe Media Encoder.");
    } else {
        alert("No valid marker ranges found.");
    }
})();