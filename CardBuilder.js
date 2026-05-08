var ICONS = {
  SHIELD: "https://www.gstatic.com/images/icons/material/system/1x/security_black_48dp.png",
  DRIVE: "https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
  OWNER: "https://www.gstatic.com/images/icons/material/system/1x/person_black_48dp.png",
  PUBLIC: "https://www.gstatic.com/images/icons/material/system/1x/public_black_48dp.png",
  EXTERNAL: "https://www.gstatic.com/images/icons/material/system/1x/domain_black_48dp.png",
  GROUP: "https://www.gstatic.com/images/icons/material/system/1x/group_black_48dp.png",
  EDIT: "https://www.gstatic.com/images/icons/material/system/1x/edit_black_48dp.png",
  VIEW: "https://www.gstatic.com/images/icons/material/system/1x/visibility_black_48dp.png",
  PATH: "https://www.gstatic.com/images/icons/material/system/1x/folder_open_black_48dp.png",
  DELETE: "https://www.gstatic.com/images/icons/material/system/1x/delete_black_48dp.png"
};

function createHomepageCard() {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader()
    .setTitle("Permissions Audit")
    .setImageUrl(ICONS.SHIELD)
    .setImageStyle(CardService.ImageStyle.CIRCLE));
  
  var emails = getOffboardEmails();
  
  // Section 1 : Offboarding
  var offboardingSection = CardService.newCardSection().setHeader("Offboarding (Départ employé)");
  
  // Saisie manuelle
  offboardingSection.addWidget(CardService.newTextInput()
    .setFieldName("newEmail")
    .setTitle("Ajouter un collaborateur (Email)"));
    
  offboardingSection.addWidget(CardService.newButtonSet()
    .addButton(CardService.newTextButton()
      .setText("+ AJOUTER")
      .setOnClickAction(CardService.newAction().setFunctionName("handleAddEmail"))));
      
  // Import Excel/Sheets
  offboardingSection.addWidget(CardService.newTextParagraph()
    .setText("<br><b>Import en masse (Excel / Sheets)</b><br><i>Format requis : Copiez vos emails dans la colonne A d'un Google Sheets, puis collez son lien ici.</i>"));
    
  offboardingSection.addWidget(CardService.newTextInput()
    .setFieldName("sheetUrl")
    .setTitle("Lien de la feuille Google Sheets"));
    
  offboardingSection.addWidget(CardService.newButtonSet()
    .addButton(CardService.newTextButton()
      .setText("IMPORTER LA LISTE")
      .setOnClickAction(CardService.newAction().setFunctionName("handleImportSheet"))));
      
  card.addSection(offboardingSection);

  // Section 2 : Liste d'attente
  if (emails.length > 0) {
    var listSection = CardService.newCardSection().setHeader("Cibles à révoquer (" + emails.length + ")");
    
    emails.slice(0, 10).forEach(function(em) {
      listSection.addWidget(CardService.newDecoratedText()
        .setText(em)
        .setButton(CardService.newImageButton()
          .setIconUrl(ICONS.DELETE)
          .setOnClickAction(CardService.newAction().setFunctionName("handleRemoveEmail").setParameters({email: em}))));
    });
    
    if (emails.length > 10) {
      listSection.addWidget(CardService.newTextParagraph().setText("<i>... et " + (emails.length - 10) + " autres adresses.</i>"));
    }
    
    listSection.addWidget(CardService.newButtonSet()
      .addButton(CardService.newTextButton()
        .setText("LANCER L'ANALYSE")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor("#188038")
        .setOnClickAction(CardService.newAction().setFunctionName("handleSearchUserAccess")))
      .addButton(CardService.newTextButton()
        .setText("VIDER")
        .setOnClickAction(CardService.newAction().setFunctionName("handleClearEmails"))));
        
    card.addSection(listSection);
  }
  
  // Section 3 : Audit classique
  var infoSection = CardService.newCardSection()
    .setHeader("Audit individuel")
    .addWidget(CardService.newTextParagraph().setText("Sélectionnez un document dans votre Drive pour analyser ses accès spécifiques."));
    
  card.addSection(infoSection);
  
  return card.build();
}

function createMultipleItemsCard() {
  return CardService.newCardBuilder()
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText("⚠️ Veuillez sélectionner un seul élément.")))
    .build();
}

function buildPermissionCard(fileId, filterValue) {
  var details = getDriveItemDetails(fileId);
  if (!details) return createHomepageCard();
  
  filterValue = filterValue || "ALL";
  var card = CardService.newCardBuilder();
  
  card.setHeader(CardService.newCardHeader()
    .setTitle(details.name)
    .setImageUrl(ICONS.DRIVE)
    .setImageStyle(CardService.ImageStyle.CIRCLE));

  var summarySection = CardService.newCardSection();
  var scoreColor = details.score > 80 ? "#188038" : (details.score > 40 ? "#e37400" : "#d93025");
  var statusText = details.isPublic ? "PUBLIC" : (details.hasExternal ? "EXTERNE" : "PRIVÉ");
  
  summarySection.addWidget(CardService.newDecoratedText()
    .setText("<font color='" + scoreColor + "'><b>Score : " + details.score + "/100 • " + statusText + "</b></font>")
    .setStartIcon(CardService.newIconImage().setIconUrl(ICONS.SHIELD)));

  var breadcrumbs = details.path.join(" > ") || "Mon Drive";
  summarySection.addWidget(CardService.newDecoratedText()
    .setTopLabel("Emplacement")
    .setText("<font color='#5f6368'>" + breadcrumbs + "</font>")
    .setWrapText(true));
    
  summarySection.addWidget(CardService.newDecoratedText()
    .setTopLabel("Propriétaire")
    .setText("<b>" + details.owner + "</b>"));

  card.addSection(summarySection);

  var filterSection = CardService.newCardSection();
  filterSection.addWidget(CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName("roleFilter")
    .addItem("Tous les membres", "ALL", filterValue === "ALL")
    .addItem("Propriétaires", "owner", filterValue === "owner")
    .addItem("Éditeurs", "writer", filterValue === "writer")
    .addItem("Lecteurs", "reader", filterValue === "reader")
    .setOnChangeAction(CardService.newAction().setFunctionName("handleFilterChange").setParameters({fileId: fileId})));
    
  card.addSection(filterSection);

  var accessSection = CardService.newCardSection().setHeader("Membres ayant accès");
  var allPerms = details.directPermissions.concat(details.inheritedPermissions);
  
  if (filterValue !== "ALL") {
    allPerms = allPerms.filter(function(p) { return p.role === filterValue; });
  }
  
  if (allPerms.length === 0) {
    accessSection.addWidget(CardService.newTextParagraph().setText("<i>Aucun membre trouvé.</i>"));
  } else {
    allPerms.forEach(function(p) {
      var origin = p.isInherited ? "Hérité" : "Direct";
      var emailText = p.email || p.domain || (p.type === 'anyone' ? 'Public' : p.displayName || p.type);
      var nameText = "<b>" + emailText + "</b>";
      if (p.isExternal) nameText += " <font color='#e37400'>(Ext.)</font>";

      var avatarUrl = p.photoLink ? (p.photoLink.startsWith('//') ? 'https:' + p.photoLink : p.photoLink) : "";

      var decoratedText = CardService.newDecoratedText()
        .setTopLabel(origin + " • " + getRoleLabel(p.role))
        .setText(nameText);
        
      if (avatarUrl) {
        decoratedText.setStartIcon(CardService.newIconImage()
          .setIconUrl(avatarUrl)
          .setImageCropType(CardService.ImageCropType.CIRCLE));
      }

      var memberClickAction = CardService.newAction()
        .setFunctionName("handleMemberClick")
        .setParameters({
          fileId: fileId,
          permId: p.id,
          email: emailText,
          role: p.role,
          isInherited: p.isInherited ? "true" : "false",
          photoLink: avatarUrl || ""
        });

      decoratedText.setOnClickAction(memberClickAction);
      accessSection.addWidget(decoratedText);
    });
  }
  card.addSection(accessSection);

  card.addSection(CardService.newCardSection()
    .addWidget(CardService.newTextButton()
      .setText("EXPORTER L'AUDIT")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction().setFunctionName("handleExportClick").setParameters({fileId: details.id, fileName: details.name}))));
  
  return card.build();
}

function handleFilterChange(e) {
  var fileId = e.parameters.fileId;
  var selectedFilter = e.formInput.roleFilter;
  var updatedCard = buildPermissionCard(fileId, selectedFilter);
  return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().updateCard(updatedCard)).build();
}

function getRoleLabel(role) {
  var roles = {'owner': 'Propriétaire', 'writer': 'Éditeur', 'commenter': 'Commentateur', 'reader': 'Lecteur'};
  return roles[role] || role;
}

function handleExportClick(e) {
  return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Audit exporté.")).build();
}

function handleMemberClick(e) {
  var fileId = e.parameters.fileId;
  var permId = e.parameters.permId;
  var email = e.parameters.email;
  var role = e.parameters.role;
  var isInherited = e.parameters.isInherited === "true";
  var photoLink = e.parameters.photoLink;
  
  var card = buildMemberDetailsCard(fileId, permId, email, role, isInherited, photoLink);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function buildMemberDetailsCard(fileId, permId, email, role, isInherited, photoLink) {
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Gestion de l'accès").setSubtitle(email));
    
  var section = CardService.newCardSection();
  
  var memberText = CardService.newDecoratedText()
    .setText("<b>" + email + "</b>")
    .setBottomLabel("Rôle actuel : " + getRoleLabel(role));
  
  if (photoLink) {
    memberText.setStartIcon(CardService.newIconImage()
      .setIconUrl(photoLink)
      .setImageCropType(CardService.ImageCropType.CIRCLE));
  }
  section.addWidget(memberText);
  
  if (role === 'owner') {
    section.addWidget(CardService.newTextParagraph().setText("<i>Vous ne pouvez pas modifier le propriétaire d'ici.</i>"));
  } else if (isInherited) {
    section.addWidget(CardService.newTextParagraph().setText("<i>Cet accès est hérité d'un dossier parent. Vous devez modifier le dossier parent pour changer cet accès.</i>"));
  } else {
    section.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setTitle("Changer le rôle")
      .setFieldName("newRole")
      .addItem("Éditeur", "writer", role === "writer")
      .addItem("Commentateur", "commenter", role === "commenter")
      .addItem("Lecteur", "reader", role === "reader")
      .setOnChangeAction(CardService.newAction().setFunctionName("handleChangeRole").setParameters({fileId: fileId, permId: permId})));
      
    section.addWidget(CardService.newButtonSet()
      .addButton(CardService.newTextButton()
        .setText("RÉVOQUER L'ACCÈS")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(CardService.newAction().setFunctionName("handleRevokeAccess").setParameters({fileId: fileId, permId: permId}))));
  }
  
  card.addSection(section);
  return card.build();
}

function handleChangeRole(e) {
  var fileId = e.parameters.fileId;
  var permId = e.parameters.permId;
  var newRole = e.formInput.newRole;
  var success = updatePermissionRole(fileId, permId, newRole);
  
  if (success) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Rôle mis à jour avec succès"))
      .setNavigation(CardService.newNavigation().popCard().updateCard(buildPermissionCard(fileId)))
      .build();
  } else {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Erreur lors de la mise à jour"))
      .build();
  }
}

function handleRevokeAccess(e) {
  var fileId = e.parameters.fileId;
  var permId = e.parameters.permId;
  var success = revokePermission(fileId, permId);
  
  if (success) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Accès révoqué"))
      .setNavigation(CardService.newNavigation().popCard().updateCard(buildPermissionCard(fileId)))
      .build();
  } else {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Erreur lors de la révocation"))
      .build();
  }
}

// --- OFFBOARDING / MASS REVOKE MANAGERS ---

function handleAddEmail(e) {
  var email = e.formInput.newEmail;
  if (email) {
    addOffboardEmail(email);
  }
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(createHomepageCard()))
    .build();
}

function handleRemoveEmail(e) {
  var email = e.parameters.email;
  removeOffboardEmail(email);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(createHomepageCard()))
    .build();
}

function handleClearEmails(e) {
  clearOffboardEmails();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(createHomepageCard()))
    .build();
}

function handleImportSheet(e) {
  var url = e.formInput.sheetUrl;
  if (!url) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Veuillez entrer un lien.")).build();
  }
  try {
    var ss = SpreadsheetApp.openByUrl(url);
    var sheet = ss.getActiveSheet();
    var data = sheet.getRange("A1:A1000").getValues(); // Limite à 1000 lignes
    var newEmails = [];
    for (var i = 0; i < data.length; i++) {
      var val = String(data[i][0]).trim();
      if (val && val.indexOf('@') !== -1) {
        newEmails.push(val);
      }
    }
    if (newEmails.length > 0) {
      addOffboardEmails(newEmails);
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(newEmails.length + " emails importés avec succès !"))
        .setNavigation(CardService.newNavigation().updateCard(createHomepageCard()))
        .build();
    } else {
      return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Aucun email trouvé dans la colonne A.")).build();
    }
  } catch (err) {
    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Erreur : le lien est invalide ou vous n'avez pas accès au fichier.")).build();
  }
}

function handleSearchUserAccess(e) {
  var emails = getOffboardEmails();
  if (emails.length === 0) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Veuillez ajouter au moins un email."))
      .build();
  }
  
  var emailInput = emails.join(',');
  var files = searchUserAccess(emailInput);
  
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Offboarding").setSubtitle("Analyse des accès"));
    
  var section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText("<b>Cibles :</b> " + emails.length + " collaborateurs"));
  
  if (files.length === 0) {
    section.addWidget(CardService.newTextParagraph().setText("Aucun accès direct trouvé pour ces utilisateurs."));
    card.addSection(section);
  } else {
    section.addWidget(CardService.newTextParagraph().setText("<b>" + files.length + " fichiers/dossiers exposés :</b>"));
    
    var displayCount = Math.min(files.length, 15);
    for (var i = 0; i < displayCount; i++) {
      section.addWidget(CardService.newDecoratedText()
        .setText(files[i].name)
        .setStartIcon(CardService.newIconImage().setIconUrl(ICONS.DRIVE)));
    }
    
    if (files.length > 15) {
      section.addWidget(CardService.newTextParagraph().setText("<i>... et " + (files.length - 15) + " autres éléments.</i>"));
    }
    card.addSection(section);
    
    var actionSection = CardService.newCardSection();
    var revokeAction = CardService.newAction()
      .setFunctionName("handleMassRevoke")
      .setParameters({email: emailInput});
      
    actionSection.addWidget(CardService.newButtonSet()
      .addButton(CardService.newTextButton()
        .setText("RÉVOQUER PARTOUT (" + files.length + ")")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor("#d93025")
        .setOnClickAction(revokeAction)));
        
    card.addSection(actionSection);
  }
  
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card.build()))
    .build();
}

function handleMassRevoke(e) {
  var email = e.parameters.email;
  var result = massRevokeUser(email);
  
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Opération terminée : " + result.revokedCount + " accès révoqués avec succès."))
    .setNavigation(CardService.newNavigation().popCard()) // Retour à l'accueil
    .build();
}
