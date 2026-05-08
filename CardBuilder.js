/**
 * URLs d'icônes stables et garanties (Material Design System)
 */
var ICONS = {
  SHIELD: "https://www.gstatic.com/images/icons/material/system/1x/security_black_48dp.png",
  DRIVE: "https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png",
  OWNER: "https://www.gstatic.com/images/icons/material/system/1x/person_black_48dp.png",
  PUBLIC: "https://www.gstatic.com/images/icons/material/system/1x/public_black_48dp.png",
  EXTERNAL: "https://www.gstatic.com/images/icons/material/system/1x/domain_black_48dp.png",
  GROUP: "https://www.gstatic.com/images/icons/material/system/1x/group_black_48dp.png",
  EDIT: "https://www.gstatic.com/images/icons/material/system/1x/edit_black_48dp.png",
  VIEW: "https://www.gstatic.com/images/icons/material/system/1x/visibility_black_48dp.png",
  INFO: "https://www.gstatic.com/images/icons/material/system/1x/info_black_48dp.png"
};

/**
 * Page d'accueil par défaut
 */
function createHomepageCard() {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader()
    .setTitle("Permissions Audit")
    .setSubtitle("Sécurité Google Drive")
    .setImageUrl(ICONS.SHIELD)
    .setImageStyle(CardService.ImageStyle.CIRCLE));
  
  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("<b>Bienvenue dans votre outil d'audit.</b><br><br>Sélectionnez un fichier ou un dossier pour analyser instantanément qui peut y accéder."));
  
  card.addSection(section);
  return card.build();
}

/**
 * Message d'erreur pour sélection multiple
 */
function createMultipleItemsCard() {
  return CardService.newCardBuilder()
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newDecoratedText()
        .setText("Sélection multiple")
        .setBottomLabel("Veuillez choisir un seul élément pour l'analyse.")
        .setStartIcon(CardService.newIconImage().setIconUrl(ICONS.INFO))))
    .build();
}

/**
 * Construction de la carte de permissions détaillée
 */
function buildPermissionCard(fileId, filterValue) {
  var details = getDriveItemDetails(fileId);
  if (!details) {
    return createHomepageCard();
  }
  
  filterValue = filterValue || "ALL";
  var card = CardService.newCardBuilder();
  
  // Header avec icône Drive
  card.setHeader(CardService.newCardHeader()
    .setTitle(details.name)
    .setSubtitle(details.isFolder ? "Dossier Partagé" : "Fichier Partagé")
    .setImageUrl(ICONS.DRIVE)
    .setImageStyle(CardService.ImageStyle.CIRCLE));

  // --- SECTION 1 : BANNIÈRE D'ÉTAT ---
  var statusSection = CardService.newCardSection();
  var statusText = "";
  var statusIcon = ICONS.SHIELD;
  
  if (details.isPublic) {
    statusText = "<font color='#d93025'><b>ALERTE : ACCÈS PUBLIC</b></font>";
    statusIcon = ICONS.PUBLIC;
  } else if (details.hasExternal) {
    statusText = "<font color='#e37400'><b>PARTAGE EXTERNE DÉTECTÉ</b></font>";
    statusIcon = ICONS.EXTERNAL;
  } else {
    statusText = "<font color='#188038'><b>ACCÈS PRIVÉ ET SÉCURISÉ</b></font>";
  }
  
  statusSection.addWidget(CardService.newDecoratedText()
    .setText(statusText)
    .setBottomLabel("Visibilité actuelle de l'élément")
    .setStartIcon(CardService.newIconImage().setIconUrl(statusIcon)));
    
  card.addSection(statusSection);

  // --- SECTION 2 : FILTRES ---
  var filterSection = CardService.newCardSection();
  var roleDropdown = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Filtrer les accès par rôle")
    .setFieldName("roleFilter")
    .addItem("Tous les accès", "ALL", filterValue === "ALL")
    .addItem("Propriétaires", "owner", filterValue === "owner")
    .addItem("Éditeurs", "writer", filterValue === "writer")
    .addItem("Commentateurs", "commenter", filterValue === "commenter")
    .addItem("Lecteurs", "reader", filterValue === "reader")
    .setOnChangeAction(CardService.newAction()
      .setFunctionName("handleFilterChange")
      .setParameters({fileId: fileId}));
      
  filterSection.addWidget(roleDropdown);
  card.addSection(filterSection);
  
  // --- SECTION 3 : LISTE DES ACCÈS ---
  var accessSection = CardService.newCardSection().setHeader("Détails des Accès");
  var allPerms = details.directPermissions.concat(details.inheritedPermissions);
  
  // Appliquer le filtre si nécessaire
  if (filterValue !== "ALL") {
    allPerms = allPerms.filter(function(p) {
      return p.role === filterValue;
    });
  }
  
  if (allPerms.length === 0) {
    accessSection.addWidget(CardService.newTextParagraph().setText("<i>Aucun accès correspondant à ce filtre.</i>"));
  } else {
    allPerms.forEach(function(p) {
      var roleIcon = (p.role === 'reader' || p.role === 'commenter') ? ICONS.VIEW : ICONS.EDIT;
      if (p.role === 'owner') roleIcon = ICONS.OWNER; // Remplacer par l'icône propriétaire

      var typeIcon = p.type === 'group' ? ICONS.GROUP : (p.type === 'domain' ? ICONS.EXTERNAL : ICONS.OWNER);
      
      var labelPrefix = p.isInherited ? "HÉRITÉ • " : "";
      var roleLabel = labelPrefix + getRoleLabel(p.role).toUpperCase();
      
      var nameText = "<b>" + (p.email || p.domain || (p.type === 'anyone' ? 'Tout le monde' : p.displayName || p.type)) + "</b>";
      if (p.isExternal) nameText += " <font color='#e37400'>(Ext.)</font>";

      accessSection.addWidget(CardService.newDecoratedText()
        .setTopLabel(roleLabel)
        .setText(nameText)
        .setStartIcon(CardService.newIconImage().setIconUrl(typeIcon))
        .setEndIcon(CardService.newIconImage().setIconUrl(roleIcon)));
    });
  }
  card.addSection(accessSection);

  // --- SECTION 4 : ACTIONS ---
  var footerSection = CardService.newCardSection();
  var exportAction = CardService.newAction()
    .setFunctionName("handleExportClick")
    .setParameters({fileId: details.id, fileName: details.name});
    
  footerSection.addWidget(CardService.newButtonSet()
    .addButton(CardService.newTextButton()
      .setText("GÉNÉRER LE RAPPORT D'AUDIT")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(exportAction)));
      
  card.addSection(footerSection);
  
  return card.build();
}

/**
 * Action déclenchée lors du changement de filtre
 */
function handleFilterChange(e) {
  var fileId = e.parameters.fileId;
  var selectedFilter = e.formInput.roleFilter;
  
  // Reconstruire la carte avec le nouveau filtre
  var updatedCard = buildPermissionCard(fileId, selectedFilter);
  
  // Mettre à jour l'interface
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(updatedCard))
    .build();
}

/**
 * Traduction des rôles Google Drive
 */
function getRoleLabel(role) {
  var roles = {
    'owner': 'Propriétaire',
    'writer': 'Éditeur',
    'commenter': 'Commentateur',
    'reader': 'Lecteur',
    'organizer': 'Organisateur',
    'fileOrganizer': 'Gestionnaire'
  };
  return roles[role] || role;
}

/**
 * Gestion du clic sur Export
 */
function handleExportClick(e) {
  var fileName = e.parameters.fileName;
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText("Rapport d'audit généré pour : " + fileName))
    .build();
}
