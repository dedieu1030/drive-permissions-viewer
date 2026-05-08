/**
 * Helper pour récupérer les détails, la hiérarchie et calculer un score de sécurité
 */
function getDriveItemDetails(fileId) {
  try {
    var file = Drive.Files.get(fileId, {
      fields: "id, name, mimeType, owners, shared, permissions, parents, webViewLink",
      supportsAllDrives: true
    });
    
    var currentUserEmail = Session.getActiveUser().getEmail();
    var currentDomain = currentUserEmail.split('@')[1] || "";
    
    var result = {
      name: file.name,
      id: file.id,
      mimeType: file.mimeType,
      isFolder: file.mimeType === "application/vnd.google-apps.folder",
      owner: file.owners && file.owners.length > 0 ? file.owners[0].emailAddress : "Inconnu",
      isPublic: false,
      hasExternal: false,
      directPermissions: [],
      inheritedPermissions: [],
      path: [],
      score: 100 // Score de base
    };
    
    // 1. Calcul du chemin (Hiérarchie)
    var currentFile = file;
    var pathNames = [];
    try {
      while (currentFile.parents && currentFile.parents.length > 0) {
        var parentId = currentFile.parents[0];
        var parentFile = Drive.Files.get(parentId, { fields: "name, parents", supportsAllDrives: true });
        pathNames.unshift(parentFile.name);
        currentFile = parentFile;
      }
    } catch (e) {
      pathNames.unshift("..."); // Si on n'a pas accès à un parent
    }
    result.path = pathNames;

    // 2. Traitement des permissions et calcul du score
    if (file.permissions) {
      processPermissions(file.permissions, result, currentDomain, false);
    }
    
    // Détection d'héritage (parent immédiat)
    if (file.parents && file.parents.length > 0) {
      try {
        var immediateParent = Drive.Files.get(file.parents[0], { fields: "permissions", supportsAllDrives: true });
        if (immediateParent.permissions) {
          processPermissions(immediateParent.permissions, result, currentDomain, true);
        }
      } catch (err) {
        console.log("Parent inaccessible");
      }
    }

    // Ajustement du score final
    if (result.isPublic) result.score -= 50;
    if (result.hasExternal) result.score -= 20;
    if (result.score < 0) result.score = 0;
    
    return result;
  } catch (e) {
    console.error(e);
    return null;
  }
}

function processPermissions(permissionsList, resultObj, currentDomain, isInherited) {
  permissionsList.forEach(function(perm) {
    var p = {
      role: perm.role,
      type: perm.type,
      email: perm.emailAddress,
      domain: perm.domain,
      displayName: perm.displayName,
      photoLink: perm.photoLink,
      isInherited: isInherited,
      id: perm.id
    };
    
    if (perm.type === 'anyone') {
      resultObj.isPublic = true;
    }
    
    if ((perm.type === 'user' || perm.type === 'group') && perm.emailAddress) {
      var permDomain = perm.emailAddress.split('@')[1];
      if (permDomain && currentDomain && permDomain !== currentDomain) {
        resultObj.hasExternal = true;
        p.isExternal = true;
      }
    }
    
    // Unicité
    var isDuplicate = resultObj.directPermissions.some(function(e) { return e.id === p.id; }) || 
                      resultObj.inheritedPermissions.some(function(e) { return e.id === p.id; });

    if (!isDuplicate) {
      if (isInherited) resultObj.inheritedPermissions.push(p);
      else resultObj.directPermissions.push(p);
    }
  });
}
