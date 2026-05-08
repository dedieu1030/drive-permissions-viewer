var ICONS = {
  SHIELD: "https://www.gstatic.com/images/icons/material/system/1x/security_black_48dp.png",
  DRIVE: "https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
  OWNER: "https://www.gstatic.com/images/icons/material/system/1x/person_black_48dp.png",
  PUBLIC: "https://www.gstatic.com/images/icons/material/system/1x/public_black_48dp.png",
  EXTERNAL: "https://www.gstatic.com/images/icons/material/system/1x/domain_black_48dp.png",
  GROUP: "https://www.gstatic.com/images/icons/material/system/1x/group_black_48dp.png",
  EDIT: "https://www.gstatic.com/images/icons/material/system/1x/edit_black_48dp.png",
  VIEW: "https://www.gstatic.com/images/icons/material/system/1x/visibility_black_48dp.png",
  PATH: "https://www.gstatic.com/images/icons/material/system/1x/folder_open_black_48dp.png"
};

function createHomepageCard() {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader()
    .setTitle("Permissions Audit")
    .setImageUrl(ICONS.SHIELD)
    .setImageStyle(CardService.ImageStyle.CIRCLE));
  
  var infoSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("<b>Audit de sécurité</b><br>Sélectionnez un document pour analyser ses risques."));
  
  // NOUVELLE SECTION : OFFBOARDING
  var offboardingSection = CardService.newCardSection().setHeader("Offboarding (Départ employé)");
  
  offboardingSection.addWidget(CardService.newTextParagraph()
    .setText("Révocation en masse des accès pour un collaborateur sur tous vos documents."));
    
  var emailInput = CardService.newTextInput()
    .setFieldName("offboardEmail")
    .setTitle("Adresse email de l'employé");
    
  var searchAction = CardService.newAction()
    .setFunctionName("handleSearchUserAccess");
    
  var searchButton = CardService.newTextButton()
    .setText("RECHERCHER LES ACCÈS")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(searchAction);
    
  offboardingSection.addWidget(emailInput);
  offboardingSection.addWidget(CardService.newButtonSet().addButton(searchButton));
  
  card.addSection(infoSection);
  card.addSection(offboardingSection);
  
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
  
  // Header ultra compact
  card.setHeader(CardService.newCardHeader()
    .setTitle(details.name)
    .setImageUrl(ICONS.DRIVE)
    .setImageStyle(CardService.ImageStyle.CIRCLE));

  // --- SECTION 1 : AUDIT RÉSUMÉ (Compact) ---
  var summarySection = CardService.newCardSection();
  
  // Score & Statut combinés
  var scoreColor = details.score > 80 ? "#188038" : (details.score > 40 ? "#e37400" : "#d93025");
  var statusText = details.isPublic ? "PUBLIC" : (details.hasExternal ? "EXTERNE" : "PRIVÉ");
  
  summarySection.addWidget(CardService.newDecoratedText()
    .setText("<font color='" + scoreColor + "'><b>Score : " + details.score + "/100 • " + statusText + "</b></font>")
    .setStartIcon(CardService.newIconImage().setIconUrl(ICONS.SHIELD)));

  // Hiérarchie simplifiée
  var breadcrumbs = details.path.join(" > ") || "Mon Drive";
  summarySection.addWidget(CardService.newDecoratedText()
    .setTopLabel("Emplacement")
    .setText("<font color='#5f6368'>" + breadcrumbs + "</font>")
    .setWrapText(true));
    
  // Propriétaire (intégré ici pour gagner de la place)
  summarySection.addWidget(CardService.newDecoratedText()
    .setTopLabel("Propriétaire")
    .setText("<b>" + details.owner + "</b>"));

  card.addSection(summarySection);

  // --- SECTION 2 : FILTRES ---
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

  // --- SECTION 3 : LISTE DES MEMBRES (Défilable naturellement) ---
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
        // Forme circulaire pour l'avatar
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

  // --- SECTION 4 : FOOTER ---
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

// --- NOUVELLES ACTIONS (MODIFICATION) ---

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
    // Actions de modification
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

// --- OFFBOARDING / MASS REVOKE ---

function handleSearchUserAccess(e) {
  var email = e.formInput.offboardEmail;
  if (!email || email.indexOf('@') === -1) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Veuillez entrer un email valide."))
      .build();
  }
  
  var files = searchUserAccess(email);
  
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Offboarding").setSubtitle(email));
    
  var section = CardService.newCardSection();
  
  if (files.length === 0) {
    section.addWidget(CardService.newTextParagraph().setText("Aucun accès direct trouvé pour cet utilisateur dans vos fichiers."));
  } else {
    section.addWidget(CardService.newTextParagraph().setText("<b>" + files.length + " fichiers ou dossiers</b> trouvés avec un accès direct pour cet utilisateur."));
    
    // Bouton pour révoquer partout
    var revokeAction = CardService.newAction()
      .setFunctionName("handleMassRevoke")
      .setParameters({email: email});
      
    section.addWidget(CardService.newButtonSet()
      .addButton(CardService.newTextButton()
        .setText("RÉVOQUER PARTOUT (" + files.length + ")")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor("#d93025")
        .setOnClickAction(revokeAction)));
  }
  
  card.addSection(section);
  
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
