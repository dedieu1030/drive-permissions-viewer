/**
 * Helper pour récupérer les détails, la hiérarchie et calculer un score de sécurité
 */
function getDriveItemDetails(fileId) {
  try {
    var file = Drive.Files.get(fileId, {
      fields: "id, name, mimeType, owners, shared, permissions, parents, webViewLink, iconLink",
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
      iconUrl: file.iconLink || "",
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

/**
 * Met à jour le rôle d'une permission existante
 */
function updatePermissionRole(fileId, permId, newRole) {
  try {
    Drive.Permissions.update({role: newRole}, fileId, permId, {supportsAllDrives: true});
    return true;
  } catch(e) {
    console.error("Erreur updatePermissionRole:", e);
    return false;
  }
}

/**
 * Supprime (révoque) une permission
 */
function revokePermission(fileId, permId) {
  try {
    Drive.Permissions.remove(fileId, permId, {supportsAllDrives: true});
    return true;
  } catch(e) {
    console.error("Erreur revokePermission:", e);
    return false;
  }
}

/**
 * Recherche tous les fichiers/dossiers auxquels un ou plusieurs utilisateurs ont un accès direct
 */
function searchUserAccess(emailInput) {
  // Découpe par virgule, point-virgule, saut de ligne ou espace
  var emails = emailInput.split(/[\n,;\s]+/).map(function(e) { return e.trim().toLowerCase(); }).filter(function(e) { return e.length > 0 && e.indexOf('@') !== -1; });
  
  // Suppression des doublons
  emails = emails.filter(function(item, pos) { return emails.indexOf(item) == pos; });
  
  if (emails.length === 0) return [];
  
  var queryParts = emails.map(function(email) {
    return "('" + email + "' in readers or '" + email + "' in writers)";
  });
  var query = queryParts.join(" or ");
  
  var files = [];
  var pageToken = null;
  
  try {
    do {
      var response = Drive.Files.list({
        q: query,
        fields: "nextPageToken, files(id, name)",
        supportsAllDrives: true,
        pageSize: 100,
        pageToken: pageToken
      });
      
      if (response.files) {
        files = files.concat(response.files);
      }
      pageToken = response.nextPageToken;
    } while (pageToken && files.length < 100); // Limite à 100 pour l'instant pour éviter les timeouts
    
    return files;
  } catch(e) {
    console.error("Erreur searchUserAccess:", e);
    return [];
  }
}

/**
 * Révoque l'accès de plusieurs utilisateurs sur une liste de fichiers
 */
function massRevokeUser(emailInput) {
  var emails = emailInput.split(/[\n,;\s]+/).map(function(e) { return e.trim().toLowerCase(); }).filter(function(e) { return e.length > 0 && e.indexOf('@') !== -1; });
  emails = emails.filter(function(item, pos) { return emails.indexOf(item) == pos; });
  
  var files = searchUserAccess(emailInput);
  var revokedCount = 0;
  
  files.forEach(function(file) {
    try {
      // On liste les permissions pour trouver l'ID exact lié à ces emails
      var permsResponse = Drive.Permissions.list(file.id, {fields: "permissions(id, emailAddress)", supportsAllDrives: true});
      if (permsResponse && permsResponse.permissions) {
        permsResponse.permissions.forEach(function(p) {
          if (p.emailAddress && emails.indexOf(p.emailAddress.toLowerCase()) !== -1) {
            Drive.Permissions.remove(file.id, p.id, {supportsAllDrives: true});
            revokedCount++;
          }
        });
      }
    } catch(e) {
      console.log("Erreur de révocation sur fichier " + file.id, e);
    }
  });
  
  return {
    totalFiles: files.length,
    revokedCount: revokedCount
  };
}

// --- STATE MANAGEMENT ---
function getOffboardEmails() {
  var props = PropertiesService.getUserProperties();
  var emails = props.getProperty('offboardEmails');
  return emails ? JSON.parse(emails) : [];
}

function addOffboardEmail(email) {
  var emails = getOffboardEmails();
  email = email.trim().toLowerCase();
  if (email && email.indexOf('@') !== -1 && emails.indexOf(email) === -1) {
    emails.push(email);
    PropertiesService.getUserProperties().setProperty('offboardEmails', JSON.stringify(emails));
  }
}

function addOffboardEmails(newEmails) {
  var emails = getOffboardEmails();
  newEmails.forEach(function(email) {
    email = email.trim().toLowerCase();
    if (email && email.indexOf('@') !== -1 && emails.indexOf(email) === -1) {
      emails.push(email);
    }
  });
  PropertiesService.getUserProperties().setProperty('offboardEmails', JSON.stringify(emails));
}

function removeOffboardEmail(email) {
  var emails = getOffboardEmails();
  emails = emails.filter(function(e) { return e !== email; });
  PropertiesService.getUserProperties().setProperty('offboardEmails', JSON.stringify(emails));
}

function clearOffboardEmails() {
  PropertiesService.getUserProperties().deleteProperty('offboardEmails');
}
