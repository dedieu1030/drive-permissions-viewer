/**
 * Helper pour récupérer les détails, la hiérarchie et calculer un score de sécurité
 */
function getDriveItemDetails(fileId) {
  try {
    var file = Drive.Files.get(fileId, {
      fields: "id, name, mimeType, owners, shared, permissions, parents, webViewLink, iconLink, capabilities",
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
      canShare: file.capabilities ? file.capabilities.canShare : false,
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
        fields: "nextPageToken, files(id, name, iconLink)",
        supportsAllDrives: true,
        pageSize: 100,
        pageToken: pageToken
      });
      
      if (response.files) {
        response.files.forEach(function(f) {
          files.push({id: f.id, name: f.name, icon: f.iconLink || ""});
        });
      }
      pageToken = response.nextPageToken;
    } while (pageToken && files.length < 200);
    
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

function getOffboardEntries() {
  var props = PropertiesService.getUserProperties();
  var data = props.getProperty('offboardEntries');
  return data ? JSON.parse(data) : [];
}

// Backward compat: also expose just emails
function getOffboardEmails() {
  return getOffboardEntries().map(function(e) { return e.email; });
}

function lookupUserPhoto(email) {
  try {
    var files = Drive.Files.list({
      q: "'" + email + "' in readers or '" + email + "' in writers",
      fields: "files(permissions(emailAddress,photoLink))",
      pageSize: 1,
      supportsAllDrives: true
    });
    if (files.files && files.files.length > 0 && files.files[0].permissions) {
      var perms = files.files[0].permissions;
      for (var i = 0; i < perms.length; i++) {
        if (perms[i].emailAddress && perms[i].emailAddress.toLowerCase() === email.toLowerCase() && perms[i].photoLink) {
          var url = perms[i].photoLink;
          return url.startsWith('//') ? 'https:' + url : url;
        }
      }
    }
  } catch(e) {}
  return "";
}

function addOffboardEmail(email) {
  var entries = getOffboardEntries();
  email = email.trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) return;
  // Check dupe
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].email === email) return;
  }
  var photo = lookupUserPhoto(email);
  entries.push({email: email, photo: photo});
  PropertiesService.getUserProperties().setProperty('offboardEntries', JSON.stringify(entries));
}

function addOffboardEmails(newEmails) {
  var entries = getOffboardEntries();
  var existingSet = {};
  entries.forEach(function(e) { existingSet[e.email] = true; });

  newEmails.forEach(function(em) {
    em = em.trim().toLowerCase();
    if (em && em.indexOf('@') !== -1 && !existingSet[em]) {
      var photo = lookupUserPhoto(em);
      entries.push({email: em, photo: photo});
      existingSet[em] = true;
    }
  });
  PropertiesService.getUserProperties().setProperty('offboardEntries', JSON.stringify(entries));
}

function removeOffboardEmail(email) {
  var entries = getOffboardEntries();
  entries = entries.filter(function(e) { return e.email !== email; });
  PropertiesService.getUserProperties().setProperty('offboardEntries', JSON.stringify(entries));
}

function clearOffboardEmails() {
  PropertiesService.getUserProperties().deleteProperty('offboardEntries');
}

// --- FOUND FILES MANAGEMENT ---

function storeFoundFiles(files) {
  PropertiesService.getUserProperties().setProperty('foundFiles', JSON.stringify(files));
}

function getFoundFiles() {
  var data = PropertiesService.getUserProperties().getProperty('foundFiles');
  return data ? JSON.parse(data) : [];
}

function removeFoundFile(fileId) {
  var files = getFoundFiles();
  files = files.filter(function(f) { return f.id !== fileId; });
  PropertiesService.getUserProperties().setProperty('foundFiles', JSON.stringify(files));
  return files;
}

function clearFoundFiles() {
  PropertiesService.getUserProperties().deleteProperty('foundFiles');
}

/**
 * Recherche des fichiers/dossiers par nom
 */
function searchFilesByName(query) {
  if (!query || query.trim().length === 0) return [];
  
  var files = [];
  var pageToken = null;
  var searchQuery = "name contains '" + query.replace(/'/g, "\\'") + "' and trashed = false";
  
  try {
    do {
      var response = Drive.Files.list({
        q: searchQuery,
        fields: "nextPageToken, files(id, name, mimeType, iconLink, owners)",
        supportsAllDrives: true,
        pageSize: 20,
        pageToken: pageToken
      });
      
      if (response.files) {
        response.files.forEach(function(f) {
          files.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            icon: f.iconLink || "",
            isFolder: f.mimeType === "application/vnd.google-apps.folder",
            owner: f.owners && f.owners.length > 0 ? f.owners[0].emailAddress : "Inconnu"
          });
        });
      }
      pageToken = response.nextPageToken;
    } while (pageToken && files.length < 20);
    
    return files;
  } catch(e) {
    console.error("Erreur searchFilesByName:", e);
    return [];
  }
}

/**
 * Liste le contenu d'un dossier avec les permissions de chaque fichier
 */
function listFolderContentsWithPermissions(folderId) {
  var results = [];
  var pageToken = null;
  
  try {
    do {
      var response = Drive.Files.list({
        q: "'" + folderId + "' in parents and trashed = false",
        fields: "nextPageToken, files(id, name, mimeType, iconLink, permissions(emailAddress, role, displayName, photoLink, type, id))",
        supportsAllDrives: true,
        pageSize: 50,
        pageToken: pageToken
      });
      
      if (response.files) {
        response.files.forEach(function(f) {
          var perms = [];
          if (f.permissions) {
            f.permissions.forEach(function(p) {
              if (p.type === 'user' || p.type === 'group') {
                perms.push({
                  email: p.emailAddress || "",
                  role: p.role,
                  displayName: p.displayName || "",
                  photoLink: p.photoLink || "",
                  type: p.type,
                  id: p.id
                });
              } else if (p.type === 'anyone') {
                perms.push({
                  email: "Public (tous)",
                  role: p.role,
                  displayName: "Tous",
                  photoLink: "",
                  type: p.type,
                  id: p.id
                });
              }
            });
          }
          
          results.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            icon: f.iconLink || "",
            isFolder: f.mimeType === "application/vnd.google-apps.folder",
            permissions: perms
          });
        });
      }
      pageToken = response.nextPageToken;
    } while (pageToken && results.length < 100);
    
    return results;
  } catch(e) {
    console.error("Erreur listFolderContentsWithPermissions:", e);
    return [];
  }
}
